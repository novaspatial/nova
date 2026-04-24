import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
} from '@/test/helpers/supabaseMock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from './route'

describe('GET /api/portal/projects/new-count', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const res = await GET()
    expect(res.status).toBe(401)
  })

  test('studio query filters by status=in_review and studio_deleted_at IS NULL', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock()
    Object.assign(projectsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [
            { id: 'p1', status: 'in_review' },
            { id: 'p2', status: 'in_review' },
          ],
          error: null,
        }),
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 's@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.role).toBe('studio')
    expect(body.projects).toEqual([
      { id: 'p1', status: 'in_review' },
      { id: 'p2', status: 'in_review' },
    ])
    expect(projectsChain.eq).toHaveBeenCalledWith('status', 'in_review')
    expect(projectsChain.is).toHaveBeenCalledWith('studio_deleted_at', null)
  })

  test('client query filters by owner_id and client_deleted_at IS NULL', async () => {
    const profileChain = createChainMock({
      data: { id: 'client-1', role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock()
    Object.assign(projectsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ id: 'p1', status: 'review' }], error: null }),
    })
    const supabase = createSupabaseMock({
      user: { id: 'client-1', email: 'c@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.role).toBe('client')
    expect(body.projects).toEqual([{ id: 'p1', status: 'review' }])
    expect(projectsChain.eq).toHaveBeenCalledWith('owner_id', 'client-1')
    expect(projectsChain.is).toHaveBeenCalledWith('client_deleted_at', null)
  })

  test('returns 500 on query error', async () => {
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock()
    Object.assign(projectsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: 'db down' } }),
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'u@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('db down')
  })
})
