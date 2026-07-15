import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock, createChainMock } from '@/test/helpers/supabaseMock'
import { cleanupProjectArtifacts } from './projectCleanup'

type Supabase = Parameters<typeof cleanupProjectArtifacts>[0]

// Storage-only since #26: the discount restore moved to the DELETE route
// (keyed on the delete-returning row), so cleanup needs only the id.
const paidProject = { id: 'proj-1' }

describe('cleanupProjectArtifacts', () => {
  beforeEach(() => vi.clearAllMocks())

  test('sweeps files + comment attachments from uploads and deliverables from its bucket', async () => {
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const deliverablesBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      fromMocks: {
        project_files: createChainMock({
          data: [{ storage_path: 'user-1/proj-1/stems.wav' }],
          error: null,
        }),
        project_comment_attachments: createChainMock({
          data: [{ storage_path: 'user-1/proj-1/comments/c1/note.png' }],
          error: null,
        }),
        deliverables: createChainMock({
          data: [{ storage_path: 'user-1/proj-1/final.wav' }],
          error: null,
        }),
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
        'project-deliverables': deliverablesBucket,
      },
    })

    const result = await cleanupProjectArtifacts(supabase as unknown as Supabase, paidProject)

    expect(result).toEqual({ error: null })
    // Attachment objects swept alongside stems — the bug this library fixes.
    expect(uploadsBucket.remove).toHaveBeenCalledWith([
      'user-1/proj-1/stems.wav',
      'user-1/proj-1/comments/c1/note.png',
    ])
    expect(deliverablesBucket.remove).toHaveBeenCalledWith([
      'user-1/proj-1/final.wav',
    ])
  })

  test('skips empty buckets and never calls remove with no paths', async () => {
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      fromMocks: {
        project_files: createChainMock({ data: [], error: null }),
        project_comment_attachments: createChainMock({ data: [], error: null }),
        deliverables: createChainMock({ data: [], error: null }),
      },
      storageMocks: { 'project-uploads': uploadsBucket },
    })

    const result = await cleanupProjectArtifacts(supabase as unknown as Supabase, paidProject)

    expect(result).toEqual({ error: null })
    expect(uploadsBucket.remove).not.toHaveBeenCalled()
  })

  test('never touches a discount RPC — cleanup is storage-only since #26', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      rpc,
      fromMocks: {
        project_files: createChainMock({ data: [], error: null }),
        project_comment_attachments: createChainMock({ data: [], error: null }),
        deliverables: createChainMock({ data: [], error: null }),
      },
    })

    await cleanupProjectArtifacts(supabase as unknown as Supabase, paidProject)

    expect(rpc).not.toHaveBeenCalled()
  })

  test('returns the error message when a storage-path lookup fails', async () => {
    const supabase = createSupabaseMock({
      fromMocks: {
        project_files: createChainMock({ data: [], error: null }),
        project_comment_attachments: createChainMock({
          data: null,
          error: { message: 'Attachment lookup failed' },
        }),
        deliverables: createChainMock({ data: [], error: null }),
      },
    })

    const result = await cleanupProjectArtifacts(supabase as unknown as Supabase, paidProject)

    expect(result).toEqual({ error: 'Attachment lookup failed' })
  })
})
