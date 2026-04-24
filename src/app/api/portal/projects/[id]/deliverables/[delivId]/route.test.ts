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

import { DELETE } from './route'

function makeParams(id: string, delivId: string) {
  return { params: Promise.resolve({ id, delivId }) }
}

describe('DELETE /api/portal/projects/[id]/deliverables/[delivId]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(401)
  })

  test('returns 403 when caller is not studio', async () => {
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(403)
  })

  test('returns 404 when project not visible to studio', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when deliverable missing', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const deliverablesChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        deliverables: deliverablesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(404)
  })

  test('returns 500 when storage.remove fails and skips DB delete', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const deliverablesChain = createChainMock({
      data: { storage_path: 'proj-1/master.wav' },
      error: null,
    })
    const removeMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        deliverables: deliverablesChain,
      },
      storageMocks: { 'project-deliverables': { remove: removeMock } },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(500)
    expect(deliverablesChain.delete).not.toHaveBeenCalled()
  })

  test('returns 403 when RLS returns zero rows from delete', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const deliverablesChain = createChainMock()
    deliverablesChain.single.mockResolvedValueOnce({
      data: { storage_path: 'proj-1/master.wav' },
      error: null,
    })
    Object.assign(deliverablesChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null }),
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        deliverables: deliverablesChain,
      },
      storageMocks: {
        'project-deliverables': {
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(403)
  })

  test('returns 204 on success — storage remove then DB delete', async () => {
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const deliverablesChain = createChainMock()
    deliverablesChain.single.mockResolvedValueOnce({
      data: { storage_path: 'proj-1/master.wav' },
      error: null,
    })
    Object.assign(deliverablesChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ id: 'd-1' }], error: null }),
    })
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        deliverables: deliverablesChain,
      },
      storageMocks: { 'project-deliverables': { remove: removeMock } },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'd-1'))
    expect(res.status).toBe(204)
    expect(removeMock).toHaveBeenCalledWith(['proj-1/master.wav'])
    expect(deliverablesChain.delete).toHaveBeenCalled()
  })
})
