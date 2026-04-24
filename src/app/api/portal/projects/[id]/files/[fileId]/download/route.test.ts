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

import { GET } from './route'

function makeParams(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

describe('GET /api/portal/projects/[id]/files/[fileId]/download', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for clients — only studio can download stems via this route', async () => {
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(403)
  })

  test('returns 404 when project not visible', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when file row missing', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const filesChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(404)
  })

  test('returns 500 when signed URL generation fails', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const filesChain = createChainMock({
      data: {
        storage_path: 'owner/proj/x.wav',
        file_name: 'x.wav',
        file_type: 'stem',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': {
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'boom' },
          }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })

  test('returns 200 with 1h signed URL forcing the file name', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const filesChain = createChainMock({
      data: {
        storage_path: 'owner/proj/bass.wav',
        file_name: 'bass.wav',
        file_type: 'stem',
      },
      error: null,
    })
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': { createSignedUrl: createSignedUrlMock },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.url).toBe('https://example.com/signed')
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      'owner/proj/bass.wav',
      3600,
      { download: 'bass.wav' },
    )
  })
})
