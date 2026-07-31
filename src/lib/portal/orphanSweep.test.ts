import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SWEEP_BATCH_SIZE,
  STALE_UPLOAD_HOURS,
  sweepOrphanedUploads,
} from './orphanSweep'

const NOW = new Date('2026-07-31T12:00:00.000Z')

type StaleRow = { id: string; storage_path: string }

/**
 * The sweep uses two shapes only — a filtered select on project_files, a
 * CAS delete on it, and one RPC — so a hand-rolled recorder is clearer
 * here than the generic chain mock, and it lets each test assert exactly
 * which tables were named.
 */
function makeSupabase({
  stale = [] as StaleRow[],
  selectError = null as { message: string } | null,
  deleteMatches,
  deleteError = null as { message: string } | null,
  orphans = [] as string[],
  orphanError = null as { message: string } | null,
  removeError = null as string | null,
} = {}) {
  const tables: string[] = []
  const removed: string[][] = []
  const rpcCalls: Array<{ fn: string; args: unknown }> = []
  const deleteFilters: Array<Record<string, unknown>> = []

  const supabase = {
    from(table: string) {
      tables.push(table)
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return chain
        },
        lte: (column: string, value: unknown) => {
          filters[column] = value
          return chain
        },
        limit: () => Promise.resolve({ data: stale, error: selectError }),
        delete: () => {
          const deleteChain = {
            eq: (column: string, value: unknown) => {
              filters[column] = value
              return deleteChain
            },
            lte: (column: string, value: unknown) => {
              filters[column] = value
              return deleteChain
            },
            select: () => {
              deleteFilters.push(filters)
              const matched =
                deleteMatches === undefined
                  ? [{ id: filters.id }]
                  : deleteMatches
                    ? [{ id: filters.id }]
                    : []
              return Promise.resolve({
                data: deleteError ? null : matched,
                error: deleteError,
              })
            },
          }
          return deleteChain
        },
      }
      return chain
    },
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args })
      return Promise.resolve({
        data: orphanError
          ? null
          : orphans.map((storage_path) => ({ storage_path })),
        error: orphanError,
      })
    },
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          removed.push(paths)
          return Promise.resolve({
            data: null,
            error: removeError ? { message: removeError } : null,
          })
        },
      }),
    },
  }

  return {
    supabase: supabase as unknown as SupabaseClient,
    tables,
    removed,
    rpcCalls,
    deleteFilters,
  }
}

describe('sweepOrphanedUploads', () => {
  test('removes the object before the row, so a failure cannot mint a new orphan', async () => {
    const { supabase, removed } = makeSupabase({
      stale: [{ id: 'file-1', storage_path: 'u1/p1/stem.wav' }],
    })

    const result = await sweepOrphanedUploads(supabase, NOW)

    expect(removed[0]).toEqual(['u1/p1/stem.wav'])
    expect(result).toMatchObject({ pendingRowsRemoved: 1 })
  })

  test('deletes with a full CAS, so a confirm mid-sweep keeps the row', async () => {
    const { supabase, deleteFilters } = makeSupabase({
      stale: [{ id: 'file-1', storage_path: 'u1/p1/stem.wav' }],
      // The delete matches nothing: upload_status flipped, or the row was
      // re-registered, between the select and the delete.
      deleteMatches: false,
    })

    const result = await sweepOrphanedUploads(supabase, NOW)

    // Not counted as removed, and the filters prove the guard is there.
    expect(result).toMatchObject({ pendingRowsRemoved: 0 })
    expect(deleteFilters[0]).toMatchObject({
      id: 'file-1',
      upload_status: 'pending',
    })
    expect(deleteFilters[0].upload_registered_at).toBe(
      new Date(
        NOW.getTime() - STALE_UPLOAD_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    )
  })

  test('a storage failure records the item and leaves its row alone', async () => {
    const { supabase, deleteFilters } = makeSupabase({
      stale: [{ id: 'file-1', storage_path: 'u1/p1/stem.wav' }],
      removeError: 'storage down',
    })

    const result = await sweepOrphanedUploads(supabase, NOW)

    expect(result).toMatchObject({
      pendingRowsRemoved: 0,
      failures: [{ target: 'u1/p1/stem.wav', error: 'storage down' }],
    })
    expect(deleteFilters).toHaveLength(0)
  })

  test('surfaces a select failure as the whole-run error', async () => {
    const { supabase } = makeSupabase({
      selectError: { message: 'db down' },
    })
    await expect(sweepOrphanedUploads(supabase, NOW)).resolves.toEqual({
      error: 'db down',
    })
  })

  test('asks the anti-join RPC for row-less attachment objects and removes them', async () => {
    const { supabase, rpcCalls, removed } = makeSupabase({
      orphans: ['u1/p1/comments/abc/take.wav', 'u1/p1/comments/def/note.wav'],
    })

    const result = await sweepOrphanedUploads(supabase, NOW)

    expect(rpcCalls[0]).toEqual({
      fn: 'list_orphan_comment_attachments',
      args: {
        p_cutoff: new Date(
          NOW.getTime() - STALE_UPLOAD_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        p_limit: SWEEP_BATCH_SIZE,
      },
    })
    expect(removed[0]).toEqual([
      'u1/p1/comments/abc/take.wav',
      'u1/p1/comments/def/note.wav',
    ])
    expect(result).toMatchObject({ orphanObjectsRemoved: 2 })
  })

  test('an RPC failure is recorded without discarding the pending-row work', async () => {
    const { supabase } = makeSupabase({
      stale: [{ id: 'file-1', storage_path: 'u1/p1/stem.wav' }],
      orphanError: { message: 'rpc down' },
    })

    await expect(sweepOrphanedUploads(supabase, NOW)).resolves.toMatchObject({
      pendingRowsRemoved: 1,
      orphanObjectsRemoved: 0,
      failures: [{ target: 'comment-attachments', error: 'rpc down' }],
    })
  })

  test('reports mayHaveMore when either batch fills', async () => {
    const full = Array.from({ length: SWEEP_BATCH_SIZE }, (_, i) => ({
      id: `file-${i}`,
      storage_path: `u1/p1/${i}.wav`,
    }))
    const { supabase } = makeSupabase({ stale: full })
    await expect(sweepOrphanedUploads(supabase, NOW)).resolves.toMatchObject({
      mayHaveMore: true,
    })

    const orphansFull = Array.from(
      { length: SWEEP_BATCH_SIZE },
      (_, i) => `u1/p1/comments/${i}/a.wav`,
    )
    const second = makeSupabase({ orphans: orphansFull })
    await expect(
      sweepOrphanedUploads(second.supabase, NOW),
    ).resolves.toMatchObject({ mayHaveMore: true })
  })

  test('a run with nothing to do is a clean no-op', async () => {
    const { supabase, removed } = makeSupabase({})
    await expect(sweepOrphanedUploads(supabase, NOW)).resolves.toEqual({
      pendingRowsRemoved: 0,
      orphanObjectsRemoved: 0,
      failures: [],
      mayHaveMore: false,
    })
    expect(removed).toHaveLength(0)
  })

  test('never touches the projects table — abandoned checkouts are a deliberate residual', async () => {
    const { supabase, tables } = makeSupabase({
      stale: [{ id: 'file-1', storage_path: 'u1/p1/stem.wav' }],
      orphans: ['u1/p1/comments/abc/take.wav'],
    })

    await sweepOrphanedUploads(supabase, NOW)

    // CLAUDE.md: "abandoned pending checkouts hold coupon capacity until
    // deleted (no sweep — accepted)". This sweeper must not quietly
    // become that sweep.
    expect(tables).not.toContain('projects')
    expect(new Set(tables)).toEqual(new Set(['project_files']))
  })
})
