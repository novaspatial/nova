import type { SupabaseClient } from '@supabase/supabase-js'

import { removeStorageObjects } from '@/lib/portal/storage'

// 90-day post-delivery retention, then the audio goes (D7; T&C §6). The
// project row survives as a tombstone stamped `files_purged_at` (D7b) — it is
// the order/consent/tax record and must outlive the files (D1).
export const RETENTION_DAYS = 90

// D7 scope: "stems and deliverables both". Since 20260725 removed the
// deliverables pipeline, deliverables are the mix-type project_files rows.
// master_ref rows are deliberately outside the decided scope, and comment
// attachments are conversation, not audio delivery — both stay.
//
// Deleting the mix rows *detaches* their comments rather than cascading
// them away (20260730, #58): the conversation and its attachments outlive
// the audio, matching what this module has always claimed. A detached
// comment has `track_id IS NULL` and is no longer rendered anywhere —
// it survives as part of the project record, not as a visible thread.
export const PURGED_FILE_TYPES = ['stem', 'mix'] as const

// Bounds one cron run; the daily schedule drains any backlog. Surfaced via
// `mayHaveMore` so a capped run never reads as a completed sweep.
export const PURGE_BATCH_SIZE = 20

export type PurgeFailure = { projectId: string; error: string }

export type PurgeResult =
  | {
      purged: string[]
      failures: PurgeFailure[]
      mayHaveMore: boolean
    }
  | { error: string }

/**
 * Purge stem + mix files for projects delivered more than RETENTION_DAYS ago,
 * stamping `files_purged_at` on each project row (the D7b tombstone).
 *
 * Sessionless by contract — callers pass the service-role client (the cron
 * has no user). Idempotent: selection excludes stamped rows, storage removal
 * of already-gone paths no-ops, and a failed project is skipped unstamped so
 * the next run retries it. Per-project failures never abort the sweep.
 */
export async function purgeExpiredDeliveredProjects(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<PurgeResult> {
  const cutoff = new Date(
    now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: candidates, error: selectError } = await supabase
    .from('projects')
    .select('id')
    .eq('status', 'delivered')
    .is('files_purged_at', null)
    .not('delivered_at', 'is', null)
    .lte('delivered_at', cutoff)
    .limit(PURGE_BATCH_SIZE)

  if (selectError) {
    return { error: selectError.message }
  }

  const purged: string[] = []
  const failures: PurgeFailure[] = []

  for (const project of candidates ?? []) {
    const files = await supabase
      .from('project_files')
      .select('storage_path')
      .eq('project_id', project.id)
      .in('file_type', [...PURGED_FILE_TYPES])

    if (files.error) {
      failures.push({ projectId: project.id, error: files.error.message })
      continue
    }

    const paths = (files.data ?? []).map((row) => row.storage_path)
    const sweep = await removeStorageObjects(supabase, 'stem', paths)
    if (sweep.error) {
      failures.push({ projectId: project.id, error: sweep.error })
      continue
    }

    const deleted = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', project.id)
      .in('file_type', [...PURGED_FILE_TYPES])

    if (deleted.error) {
      failures.push({ projectId: project.id, error: deleted.error.message })
      continue
    }

    // The tombstone stamp comes last so any earlier failure leaves the row
    // unstamped and the next run retries the whole project.
    const stamped = await supabase
      .from('projects')
      .update({ files_purged_at: now.toISOString() })
      .eq('id', project.id)
      .is('files_purged_at', null)

    if (stamped.error) {
      failures.push({ projectId: project.id, error: stamped.error.message })
      continue
    }

    purged.push(project.id)
  }

  return {
    purged,
    failures,
    mayHaveMore: (candidates ?? []).length === PURGE_BATCH_SIZE,
  }
}
