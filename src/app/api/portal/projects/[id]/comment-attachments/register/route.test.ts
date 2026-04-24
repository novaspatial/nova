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

describe('POST /api/portal/projects/[id]/comment-attachments/register', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest({
      fileName: 'photo.png',
      fileSize: 1024,
      mimeType: 'image/png',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not visible', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'photo.png',
      fileSize: 1024,
      mimeType: 'image/png',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(404)
  })

  test('returns 400 when any of fileName / fileSize / mimeType is missing', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ fileName: 'photo.png' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/fileName, fileSize, and mimeType/)
  })

  test('sanitises file name and builds the expected storage path', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-9' },
      error: null,
    })
    const signedUploadMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/upload' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
      storageMocks: {
        'project-uploads': { createSignedUploadUrl: signedUploadMock },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'my photo (1).png',
      fileSize: 512,
      mimeType: 'image/png',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.uploadUrl).toBe('https://example.com/upload')

    const [storagePath] = signedUploadMock.mock.calls[0]
    expect(storagePath).toMatch(
      /^owner-9\/proj-1\/comments\/[0-9a-f-]+\/my_photo__1_\.png$/,
    )
    // storagePath echoed in the response so clients can register the row later
    expect(body.storagePath).toBe(storagePath)
  })

  test('returns 500 when signed upload creation fails', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-1' },
      error: null,
    })
    const signedUploadMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage boom' },
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
      storageMocks: {
        'project-uploads': { createSignedUploadUrl: signedUploadMock },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'photo.png',
      fileSize: 1024,
      mimeType: 'image/png',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Storage boom')
  })
})
