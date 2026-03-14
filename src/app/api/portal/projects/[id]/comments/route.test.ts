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

describe('GET /api/portal/projects/[id]/comments', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns comments list for authenticated user', async () => {
    const commentsData = [
      { id: 'c1', body: 'Great mix', timestamp_ms: 30000 },
      { id: 'c2', body: 'Lower the bass', timestamp_ms: 45000 },
    ]
    const commentsChain = createChainMock({
      data: commentsData,
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_comments: commentsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    // Verify query was ordered by created_at ascending
    expect(commentsChain.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    })
  })

  test('returns 500 when comment lookup fails', async () => {
    const commentsChain = createChainMock({
      data: null,
      error: { message: 'Database error' },
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_comments: commentsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'GET' })
    const res = await GET(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Database error' })
  })
})

describe('POST /api/portal/projects/[id]/comments', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 400 when comment body is missing', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ timestampMs: 5000 })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Comment body is required')
  })

  test('returns 400 when body is empty string', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ body: '' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)
  })

  test('returns 404 when project not found', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      body: 'Nice mix',
      timestampMs: 30000,
    })
    const res = await POST(req as NextRequest, makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  test('creates comment with timestamp', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const commentData = {
      id: 'c-new',
      body: 'Lower the bass here',
      timestamp_ms: 42000,
      author: { display_name: 'Test User', avatar_url: null, role: 'client' },
    }
    const commentsChain = createChainMock({
      data: commentData,
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      body: 'Lower the bass here',
      timestampMs: 42000,
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const resBody = await res.json()
    expect(resBody.body).toBe('Lower the bass here')
    expect(resBody.timestamp_ms).toBe(42000)
  })

  test('trims body and forwards parentId when creating threaded comments', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const commentsChain = createChainMock({
      data: {
        id: 'c-reply',
        body: 'Thanks for the note',
        timestamp_ms: 15000,
        parent_id: 'comment-1',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      body: '  Thanks for the note  ',
      timestampMs: 15000,
      parentId: 'comment-1',
    })
    const res = await POST(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    expect(commentsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Thanks for the note',
        parent_id: 'comment-1',
        timestamp_ms: 15000,
      }),
    )
  })

  test('creates comment without timestamp', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const commentsChain = createChainMock({
      data: { id: 'c-new', body: 'Overall great', timestamp_ms: null },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ body: 'Overall great' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    // Insert should pass null for timestamp_ms
    expect(commentsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp_ms: null,
      }),
    )
  })

  test('returns 500 when comment insert fails', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const commentsChain = createChainMock({
      data: null,
      error: { message: 'Insert failed' },
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ body: 'Needs revision' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Insert failed' })
  })
})
