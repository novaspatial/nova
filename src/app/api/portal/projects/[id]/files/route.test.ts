import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { POST } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/portal/projects/[id]/files', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest({
      fileName: 'track.wav',
      fileSize: 1024,
      mimeType: 'audio/wav',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not found', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'track.wav',
      fileSize: 1024,
      mimeType: 'audio/wav',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(404)
  })

  test('returns 400 when required fields are missing', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'user-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    // Missing fileSize and mimeType
    const req = createMockRequest({ fileName: 'track.wav' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('fileName, fileSize, and mimeType are required')
  })

  test('registers file and returns signed upload URL', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'user-1' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { id: 'file-1', file_name: 'track.wav' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': {
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.example.com/upload/signed' },
            error: null,
          }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'track.wav',
      fileSize: 44100,
      mimeType: 'audio/wav',
      fileType: 'stem',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.fileId).toBe('file-1')
    expect(body.uploadUrl).toBe('https://storage.example.com/upload/signed')

    // Verify correct storage path was used
    expect(supabase.storage.from).toHaveBeenCalledWith('project-uploads')
  })

  test('constructs storage path from owner_id/project_id/filename', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-42', owner_id: 'owner-99' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { id: 'file-1' },
      error: null,
    })
    const signedUploadMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/upload' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': {
          createSignedUploadUrl: signedUploadMock,
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'bass.wav',
      fileSize: 2048,
      mimeType: 'audio/wav',
    })
    await POST(req as NextRequest, makeParams('proj-42'))

    // Verify the storage path follows {owner_id}/{project_id}/{filename}
    expect(signedUploadMock).toHaveBeenCalledWith(
      'owner-99/proj-42/bass.wav',
      { upsert: false }
    )
  })
})
