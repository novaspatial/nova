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

function makeParams(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

describe('DELETE /api/portal/projects/[id]/files/[fileId]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project not visible', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain, profiles: profileChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when file row is missing', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'uploading' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const filesChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_files: filesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(404)
  })

  test('returns 403 when a client tries to delete another user file', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'uploading' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { storage_path: 'a/b/x.wav', uploaded_by: 'someone-else' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'u@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_files: filesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(403)
  })

  test('returns 403 when client owns the file but project is past the upload window', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'mixing' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { storage_path: 'a/b/x.wav', uploaded_by: 'user-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'u@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_files: filesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(403)
  })

  test('bubbles storage.remove error as 500', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'uploading' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { storage_path: 'a/b/x.wav', uploaded_by: 'client-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 's@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': {
          remove: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'boom' } }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })

  test('studio can always delete; removes from storage then DB, returns 204', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { storage_path: 'owner/proj/x.wav', uploaded_by: 'client-1' },
      error: null,
    })
    // The delete()...eq().eq() chain resolves via the thenable; no single().
    Object.assign(filesChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null }),
    })
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 's@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_files: filesChain,
      },
      storageMocks: { 'project-uploads': { remove: removeMock } },
    })
    // First project_files lookup uses .single(); override with the file row once.
    filesChain.single.mockResolvedValueOnce({
      data: { storage_path: 'owner/proj/x.wav', uploaded_by: 'client-1' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'f-1'))
    expect(res.status).toBe(204)
    expect(removeMock).toHaveBeenCalledWith(['owner/proj/x.wav'])
    expect(filesChain.delete).toHaveBeenCalled()
  })
})
