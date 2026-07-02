import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
} from '@/test/helpers/supabaseMock'

// Mocks
const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from './route'

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
    expect(projectsChain.is).toHaveBeenCalledWith('client_deleted_at', null)
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
    expect(projectsChain.is).toHaveBeenCalledWith('studio_deleted_at', null)
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
