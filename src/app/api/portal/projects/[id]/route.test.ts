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

import { GET, PATCH } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/portal/projects/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not found', async () => {
    const projectsChain = createChainMock({ data: null, error: { message: 'Not found' } })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  test('returns project with files, comments, and deliverables', async () => {
    const projectData = {
      id: 'proj-1',
      title: 'Test',
      status: 'review',
    }
    const projectsChain = createChainMock({
      data: projectData,
      error: null,
    })
    const filesChain = createChainMock({
      data: [{ id: 'file-1', file_name: 'track.wav' }],
      error: null,
    })
    const commentsChain = createChainMock({
      data: [{ id: 'comment-1', body: 'Great mix' }],
      error: null,
    })
    const deliverablesChain = createChainMock({
      data: [],
      error: null,
    })

    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_files: filesChain,
        project_comments: commentsChain,
        deliverables: deliverablesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe('proj-1')
    expect(body.files).toHaveLength(1)
    expect(body.comments).toHaveLength(1)
    expect(body.deliverables).toHaveLength(0)
  })
})

describe('PATCH /api/portal/projects/[id]', () => {
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

    const req = createMockRequest({ status: 'approved' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  test('returns 400 for invalid status value', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: 'invalid_status' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Invalid status')
  })

  test('updates project status for studio user', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'approved' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: 'approved' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('approved')
  })

  test('accepts all valid status values', async () => {
    const validStatuses = [
      'uploading',
      'processing',
      'mixing',
      'review',
      'revision',
      'approved',
      'delivered',
    ]

    for (const status of validStatuses) {
      vi.clearAllMocks()

      const profileChain = createChainMock({
        data: { role: 'studio' },
        error: null,
      })
      const projectsChain = createChainMock({
        data: { id: 'proj-1', status },
        error: null,
      })
      const supabase = createSupabaseMock({
        user: { id: 'studio-1', email: 'studio@test.com' },
        fromMocks: { profiles: profileChain, projects: projectsChain },
      })
      mockCreateClient.mockResolvedValue(supabase)

      const req = createMockRequest({ status })
      const res = await PATCH(req as NextRequest, makeParams('proj-1'))
      expect(res.status).toBe(200)
    }
  })
})
