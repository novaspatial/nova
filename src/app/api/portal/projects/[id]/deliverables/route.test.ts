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

import { GET, POST } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/portal/projects/[id]/deliverables', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns deliverables list', async () => {
    const deliverablesChain = createChainMock({
      data: [
        { id: 'd1', file_name: 'master.wav', format: 'adm_bwf' },
      ],
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { deliverables: deliverablesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    expect(deliverablesChain.eq).toHaveBeenCalledWith(
      'project_id',
      'proj-1',
    )
    expect(deliverablesChain.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    })
  })
})

describe('POST /api/portal/projects/[id]/deliverables', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 403 when user is not studio role', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'master.wav',
      fileSize: 50000,
      storagePath: 'proj-1/master.wav',
      format: 'adm_bwf',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  test('returns 400 when required fields are missing', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'master.wav',
      fileSize: 50000,
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe(
      'fileName, fileSize, and format are required',
    )
  })

  test('creates deliverable for studio user', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-1' },
      error: null,
    })
    const deliverablesChain = createChainMock({
      data: {
        id: 'd-new',
        file_name: 'master.wav',
        format: 'adm_bwf',
        approved_by: 'studio-1',
      },
      error: null,
    })
    const createSignedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/upload' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        deliverables: deliverablesChain,
      },
      storageMocks: {
        'project-deliverables': {
          createSignedUploadUrl: createSignedUrlMock,
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      fileName: 'master.wav',
      fileSize: 50000,
      format: 'adm_bwf',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.deliverableId).toBe('d-new')
    expect(body.uploadUrl).toBe('https://example.com/upload')
  })
})
