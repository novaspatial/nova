import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'

// Mocks
const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET, POST } from './route'

describe('GET /api/portal/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when supabase client is null', async () => {
    mockCreateClient.mockResolvedValue(null)

    const res = await GET()
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 401 when user is not authenticated', async () => {
    const supabase = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(401)
  })

  test('returns only own projects for client role', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: [{ id: 'proj-1', title: 'My Project' }],
      error: null,
    })

    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(200)

    // Client query should filter by owner_id
    expect(projectsChain.eq).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  test('returns all projects for studio role', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: [
        { id: 'proj-1', title: 'Client A' },
        { id: 'proj-2', title: 'Client B' },
      ],
      error: null,
    })

    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(200)

    // Studio query should NOT call eq('owner_id', ...)
    const eqCalls = projectsChain.eq.mock.calls
    const ownerFilter = eqCalls.find(
      (call: unknown[]) => call[0] === 'owner_id',
    )
    expect(ownerFilter).toBeUndefined()
  })

  test('returns 500 when project lookup fails', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: null,
      error: { message: 'Database error' },
    })

    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Database error' })
  })
})

describe('POST /api/portal/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest({ title: 'New Project' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
  })

  test('returns 400 when title is missing', async () => {
    const supabase = createSupabaseMock()
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ format: 'atmos' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Title is required')
  })

  test('returns 400 when title is empty string', async () => {
    const supabase = createSupabaseMock()
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ title: '' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test('creates project and returns it', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-new', title: 'Test Project', status: 'uploading' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      title: 'Test Project',
      format: 'atmos',
      notes: 'Some notes',
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe('proj-new')
    expect(body.title).toBe('Test Project')
  })

  test('trims title and falls back to default format and null notes', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-new', title: 'Trimmed Title', status: 'uploading' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      title: '  Trimmed Title  ',
    })

    const res = await POST(req as NextRequest)

    expect(res.status).toBe(200)
    expect(projectsChain.insert).toHaveBeenCalledWith({
      owner_id: 'user-1',
      title: 'Trimmed Title',
      format: 'atmos',
      notes: null,
      status: 'uploading',
    })
  })

  test('returns 500 when insert fails', async () => {
    const projectsChain = createChainMock({
      data: null,
      error: { message: 'Insert failed' },
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ title: 'New Project' })
    const res = await POST(req as NextRequest)

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Insert failed' })
  })
})
