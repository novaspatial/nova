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

function makeParams(id: string, attachmentId: string) {
  return { params: Promise.resolve({ id, attachmentId }) }
}

describe('GET /api/portal/projects/[id]/comment-attachments/[attachmentId]/download', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'att-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not visible', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'att-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when attachment missing on the project', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const attachmentsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comment_attachments: attachmentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'att-1'))
    expect(res.status).toBe(404)
  })

  test('returns 500 when signed URL generation fails', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const attachmentsChain = createChainMock({
      data: { storage_path: 'a/b/c/x.png', file_name: 'x.png' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comment_attachments: attachmentsChain,
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
    const res = await GET(req as NextRequest, makeParams('proj-1', 'att-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })

  test('returns 200 with a 1h signed URL forcing the attachment file name', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const attachmentsChain = createChainMock({
      data: { storage_path: 'owner/proj/comments/u/photo.png', file_name: 'photo.png' },
      error: null,
    })
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comment_attachments: attachmentsChain,
      },
      storageMocks: {
        'project-uploads': { createSignedUrl: createSignedUrlMock },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'att-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://example.com/signed')

    expect(createSignedUrlMock).toHaveBeenCalledWith(
      'owner/proj/comments/u/photo.png',
      3600,
      { download: 'photo.png' },
    )
  })
})
