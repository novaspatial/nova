import type { SupabaseClient } from '@supabase/supabase-js'

import { removeStorageObjects } from '@/lib/portal/storage'

/**
 * Sweep the two kinds of upload leftovers that nothing else collects
 * (#59 item 8).
 *
 * 1. `project_files` rows stuck at `upload_status = 'pending'`: the
 *    register step creates them before the browser PUTs, so an abandoned
 *    or failed upload leaves a row (and possibly a partial object)
 *    forever. Harmless to /listen, which filters on 'uploaded', but it
 *    accumulates.
 * 2. Comment-attachment objects with no row at all: those are signed
 *    under a fresh UUID and only become rows when the listen POST
 *    submits the comment, so an abandoned compose leaves bytes nothing
 *    references — invisible to any sweep over the app's own tables, and
 *    missed by project deletion, which collects paths from the child
 *    tables.
 *
 * BOUNDARY, load-bearing: this module reads and writes `project_files`,
 * reads `project_comment_attachments`, and removes storage objects. It
 * must never touch `projects`. Abandoned pending-payment checkouts
 * holding coupon capacity is a deliberate residual (CLAUDE.md) — a
 * decision, not a leak for this to clean up. There is a test asserting
 * the table is never named.
 *
 * Sessionless by contract like the retention purge: callers pass the
 * service-role client. Per-item failures never abort the sweep, and
 * nothing here is destructive to a row that is still in play — see the
 * CAS on the delete.
 */

/**
 * How long a registration may sit pending before it is considered
 * abandoned. Supabase signed upload URLs are valid for 2 hours, so
 * nothing legitimate can *start* after that; the rest of the margin
 * covers a large file on a slow link plus the upload runner's retries.
 * Under a daily cron a tighter value would change nothing anyway.
 */
export const STALE_UPLOAD_HOURS = 24

/** Bounds one run; `mayHaveMore` keeps a capped run from reading as a complete one. */
export const SWEEP_BATCH_SIZE = 20

export type SweepFailure = { target: string; error: string }

export type SweepResult =
  | {
      pendingRowsRemoved: number
      orphanObjectsRemoved: number
      failures: SweepFailure[]
      mayHaveMore: boolean
    }
  | { error: string }

export async function sweepOrphanedUploads(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<SweepResult> {
  const cutoff = new Date(
    now.getTime() - STALE_UPLOAD_HOURS * 60 * 60 * 1000,
  ).toISOString()

  const failures: SweepFailure[] = []

  const { data: stale, error: selectError } = await supabase
    .from('project_files')
    .select('id, storage_path')
    .eq('upload_status', 'pending')
    .lte('upload_registered_at', cutoff)
    .limit(SWEEP_BATCH_SIZE)

  if (selectError) {
    return { error: selectError.message }
  }

  let pendingRowsRemoved = 0
  for (const row of stale ?? []) {
    // Object first, deliberately: the reverse order would mint exactly
    // the row-less orphan this sweeper exists to clean up. Removing an
    // absent object is a no-op, so a partial upload and a never-started
    // one take the same path.
    const sweep = await removeStorageObjects(supabase, 'stem', [
      row.storage_path,
    ])
    if (sweep.error) {
      failures.push({ target: row.storage_path, error: sweep.error })
      continue
    }

    // Full CAS on the delete: a confirm or a re-register landing between
    // the select and here flips upload_status or restamps
    // upload_registered_at, and the delete then matches nothing — the row
    // survives and the next run re-evaluates it.
    const deleted = await supabase
      .from('project_files')
      .delete()
      .eq('id', row.id)
      .eq('upload_status', 'pending')
      .lte('upload_registered_at', cutoff)
      .select('id')

    if (deleted.error) {
      failures.push({ target: row.storage_path, error: deleted.error.message })
      continue
    }
    pendingRowsRemoved += (deleted.data ?? []).length
  }

  // The anti-join runs in the database (service-only RPC): storage.objects
  // is not reachable through PostgREST, and one exact query beats
  // paginating the whole bucket through the storage API.
  const { data: orphans, error: orphanError } = await supabase.rpc(
    'list_orphan_comment_attachments',
    { p_cutoff: cutoff, p_limit: SWEEP_BATCH_SIZE },
  )

  if (orphanError) {
    return {
      pendingRowsRemoved,
      orphanObjectsRemoved: 0,
      failures: [
        ...failures,
        { target: 'comment-attachments', error: orphanError.message },
      ],
      mayHaveMore: (stale ?? []).length === SWEEP_BATCH_SIZE,
    }
  }

  const orphanPaths = (
    (orphans ?? []) as Array<{ storage_path: string }>
  ).map((row) => row.storage_path)

  let orphanObjectsRemoved = 0
  if (orphanPaths.length > 0) {
    const sweep = await removeStorageObjects(supabase, 'stem', orphanPaths)
    if (sweep.error) {
      failures.push({ target: 'comment-attachments', error: sweep.error })
    } else {
      orphanObjectsRemoved = orphanPaths.length
    }
  }

  return {
    pendingRowsRemoved,
    orphanObjectsRemoved,
    failures,
    mayHaveMore:
      (stale ?? []).length === SWEEP_BATCH_SIZE ||
      orphanPaths.length === SWEEP_BATCH_SIZE,
  }
}
