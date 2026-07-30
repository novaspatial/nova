import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock, createChainMock } from '@/test/helpers/supabaseMock'
import {
  collectProjectStoragePaths,
  removeProjectStorageObjects,
} from './projectCleanup'

type Supabase = Parameters<typeof collectProjectStoragePaths>[0]

// The delete route's ordering since #48: collect the paths while the child
// rows still exist, delete the row, then sweep. The helper pair mirrors it.
async function collectThenSweep(supabase: Supabase, project: { id: string }) {
  const { paths, error } = await collectProjectStoragePaths(supabase, project)
  if (error) return { error }
  return removeProjectStorageObjects(supabase, paths)
}

// Storage-only since #26: the discount restore moved to the DELETE route
// (keyed on the delete-returning row), so cleanup needs only the id.
const paidProject = { id: 'proj-1' }

describe('project storage cleanup', () => {
  beforeEach(() => vi.clearAllMocks())

  test('sweeps files + comment attachments from the uploads bucket', async () => {
    const uploadsBucket = {
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
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
      },
    })

    const result = await collectThenSweep(supabase as unknown as Supabase, paidProject)

    expect(result).toEqual({ error: null })
    // Attachment objects swept alongside stems — the bug this library fixes.
    expect(uploadsBucket.remove).toHaveBeenCalledWith([
      'user-1/proj-1/stems.wav',
      'user-1/proj-1/comments/c1/note.png',
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
      },
      storageMocks: { 'project-uploads': uploadsBucket },
    })

    const result = await collectThenSweep(supabase as unknown as Supabase, paidProject)

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
      },
    })

    await collectThenSweep(supabase as unknown as Supabase, paidProject)

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
      },
    })

    const result = await collectThenSweep(supabase as unknown as Supabase, paidProject)

    expect(result).toEqual({ error: 'Attachment lookup failed' })
  })

  test('collects paths without removing anything — the sweep is a separate step', async () => {
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      fromMocks: {
        project_files: createChainMock({
          data: [{ storage_path: 'user-1/proj-1/stems.wav' }],
          error: null,
        }),
        project_comment_attachments: createChainMock({ data: [], error: null }),
      },
      storageMocks: { 'project-uploads': uploadsBucket },
    })

    const result = await collectProjectStoragePaths(
      supabase as unknown as Supabase,
      paidProject,
    )

    expect(result).toEqual({ paths: ['user-1/proj-1/stems.wav'], error: null })
    // Nothing is destroyed until the project row is actually gone (#48).
    expect(uploadsBucket.remove).not.toHaveBeenCalled()
  })
})
