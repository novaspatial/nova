import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createSupabaseMock,
  createChainMock,
} from '@/test/helpers/supabaseMock'
import {
  purgeExpiredDeliveredProjects,
  PURGE_BATCH_SIZE,
} from '@/lib/portal/retentionPurge'

const NOW = new Date('2026-07-26T12:00:00.000Z')
// 90 days before NOW.
const CUTOFF = '2026-04-27T12:00:00.000Z'

const asClient = (mock: unknown) => mock as unknown as SupabaseClient

describe('purgeExpiredDeliveredProjects', () => {
  beforeEach(() => vi.clearAllMocks())

  test('selects only unpurged delivered projects past the 90-day window', async () => {
    const projectsChain = createChainMock({ data: [], error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(projectsChain.eq).toHaveBeenCalledWith('status', 'delivered')
    expect(projectsChain.is).toHaveBeenCalledWith('files_purged_at', null)
    expect(projectsChain.not).toHaveBeenCalledWith('delivered_at', 'is', null)
    expect(projectsChain.lte).toHaveBeenCalledWith('delivered_at', CUTOFF)
    expect(projectsChain.limit).toHaveBeenCalledWith(PURGE_BATCH_SIZE)
  })

  test('no candidates: touches nothing and reports an empty run', async () => {
    const projectsChain = createChainMock({ data: [], error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toEqual({ purged: [], failures: [], mayHaveMore: false })
    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('surfaces the selection error', async () => {
    const projectsChain = createChainMock({
      data: null,
      error: { message: 'db unreachable' },
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toEqual({ error: 'db unreachable' })
  })

  test('purges stem + mix files and stamps the tombstone', async () => {
    const projectsChain = createChainMock({
      data: [{ id: 'proj-1' }, { id: 'proj-2' }],
      error: null,
    })
    const filesChain = createChainMock({
      data: [{ storage_path: 'o/p/stem.wav' }, { storage_path: 'o/p/mixes/mix.wav' }],
      error: null,
    })
    const remove = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain, project_files: filesChain },
      storageMocks: { 'project-uploads': { remove } },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toEqual({
      purged: ['proj-1', 'proj-2'],
      failures: [],
      mayHaveMore: false,
    })
    // File rows are looked up and deleted per project, stem + mix only.
    expect(filesChain.in).toHaveBeenCalledWith('file_type', ['stem', 'mix'])
    expect(filesChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    expect(filesChain.eq).toHaveBeenCalledWith('project_id', 'proj-2')
    expect(filesChain.delete).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith(['o/p/stem.wav', 'o/p/mixes/mix.wav'])
    // Tombstone: CAS-stamped with the run's timestamp.
    expect(projectsChain.update).toHaveBeenCalledWith({
      files_purged_at: NOW.toISOString(),
    })
    expect(projectsChain.is).toHaveBeenCalledWith('files_purged_at', null)
    expect(projectsChain.eq).toHaveBeenCalledWith('id', 'proj-1')
    expect(projectsChain.eq).toHaveBeenCalledWith('id', 'proj-2')
  })

  test('a project with no stem/mix rows still gets its tombstone', async () => {
    const projectsChain = createChainMock({
      data: [{ id: 'proj-1' }],
      error: null,
    })
    const filesChain = createChainMock({ data: [], error: null })
    const remove = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain, project_files: filesChain },
      storageMocks: { 'project-uploads': { remove } },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toEqual({ purged: ['proj-1'], failures: [], mayHaveMore: false })
    // Empty path list never hits storage (removeStorageObjects no-ops).
    expect(remove).not.toHaveBeenCalled()
    expect(projectsChain.update).toHaveBeenCalledWith({
      files_purged_at: NOW.toISOString(),
    })
  })

  test('a storage failure skips the stamp and is retried next run', async () => {
    const projectsChain = createChainMock({
      data: [{ id: 'proj-1' }],
      error: null,
    })
    const filesChain = createChainMock({
      data: [{ storage_path: 'o/p/stem.wav' }],
      error: null,
    })
    const remove = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'storage down' } })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain, project_files: filesChain },
      storageMocks: { 'project-uploads': { remove } },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toEqual({
      purged: [],
      failures: [{ projectId: 'proj-1', error: 'storage down' }],
      mayHaveMore: false,
    })
    // Failed project keeps its rows and stays unstamped for the next run.
    expect(filesChain.delete).not.toHaveBeenCalled()
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('a full batch reports mayHaveMore', async () => {
    const projectsChain = createChainMock({
      data: Array.from({ length: PURGE_BATCH_SIZE }, (_, i) => ({
        id: `proj-${i}`,
      })),
      error: null,
    })
    const filesChain = createChainMock({ data: [], error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain, project_files: filesChain },
    })

    const result = await purgeExpiredDeliveredProjects(asClient(supabase), NOW)

    expect(result).toMatchObject({ mayHaveMore: true })
  })
})
