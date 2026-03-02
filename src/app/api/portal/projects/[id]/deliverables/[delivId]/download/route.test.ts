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

function makeParams(id: string, delivId: string) {
  return { params: Promise.resolve({ id, delivId }) }
}

describe('GET /api/portal/projects/[id]/deliverables/[delivId]/download', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'deliv-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not found', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'deliv-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when deliverable not found', async () => {
    const projectsChain = createChainMock({ data: { id: 'proj-1' }, error: null })
    const deliverablesChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { 
        projects: projectsChain,
        deliverables: deliverablesChain
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'deliv-1'))
    expect(res.status).toBe(404)
  })

  test('returns 500 when signed URL generation fails', async () => {
    const projectsChain = createChainMock({ data: { id: 'proj-1' }, error: null })
    const deliverablesChain = createChainMock({ 
      data: { storage_path: 'user-1/proj-1/deliv-1.wav', file_name: 'deliv-1.wav' }, 
      error: null 
    })
    const supabase = createSupabaseMock({
      fromMocks: { 
        projects: projectsChain,
        deliverables: deliverablesChain
      },
      storageMocks: {
        'project-deliverables': {
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage error' },
          }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'deliv-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Storage error')
  })

  test('returns 200 with signed download URL', async () => {
    const projectsChain = createChainMock({ data: { id: 'proj-1' }, error: null })
    const deliverablesChain = createChainMock({ 
      data: { storage_path: 'user-1/proj-1/deliv-1.wav', file_name: 'deliv-1.wav' }, 
      error: null 
    })
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/download/signed' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { 
        projects: projectsChain,
        deliverables: deliverablesChain
      },
      storageMocks: {
        'project-deliverables': {
          createSignedUrl: createSignedUrlMock,
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await GET(req as NextRequest, makeParams('proj-1', 'deliv-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.url).toBe('https://storage.example.com/download/signed')

    // Verify correct storage path and expiry was used
    expect(supabase.storage.from).toHaveBeenCalledWith('project-deliverables')
    expect(createSignedUrlMock).toHaveBeenCalledWith('user-1/proj-1/deliv-1.wav', 3600)
  })
})
