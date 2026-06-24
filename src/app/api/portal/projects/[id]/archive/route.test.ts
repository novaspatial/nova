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

import { DELETE, POST } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function studioWithProject() {
  const profileChain = createChainMock({
    data: { id: 'studio-1', role: 'studio' },
    error: null,
  })
  const projectsChain = createChainMock()
  // First single() → getProjectOrApiNotFound visibility lookup.
  // Second single() → the update().select().single() result.
  projectsChain.single
    .mockResolvedValueOnce({
      data: { id: 'proj-1', studio_deleted_at: null },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { id: 'proj-1', archived_at: '2026-06-24T00:00:00.000Z' },
      error: null,
    })
  const supabase = createSupabaseMock({
    user: { id: 'studio-1', email: 'studio@test.com' },
    fromMocks: { profiles: profileChain, projects: projectsChain },
  })
  return { supabase, projectsChain }
}

describe('POST /api/portal/projects/[id]/archive', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 403 when the user is not studio', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'POST' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  test('returns 404 when the project does not exist', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'POST' })
    const res = await POST(req as NextRequest, makeParams('missing'))

    expect(res.status).toBe(404)
  })

  test('archives the project for a studio user', async () => {
    const { supabase, projectsChain } = studioWithProject()
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'POST' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, archived: true })

    const updateArg = projectsChain.update.mock.calls[0]?.[0] as {
      archived_at: string | null
    }
    expect(updateArg.archived_at).toEqual(expect.any(String))
  })

  test('returns 500 when the update fails', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock()
    projectsChain.single
      .mockResolvedValueOnce({
        data: { id: 'proj-1', studio_deleted_at: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'POST' })
    const res = await POST(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Update failed' })
  })
})

describe('DELETE /api/portal/projects/[id]/archive', () => {
  beforeEach(() => vi.clearAllMocks())

  test('unarchives the project for a studio user', async () => {
    const { supabase, projectsChain } = studioWithProject()
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, archived: false })

    const updateArg = projectsChain.update.mock.calls[0]?.[0] as {
      archived_at: string | null
    }
    expect(updateArg.archived_at).toBeNull()
  })

  test('returns 403 when the user is not studio', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(403)
  })
})
