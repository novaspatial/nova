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

function makeParams(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) }
}

describe('DELETE /api/portal/projects/[id]/comments/[commentId]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when project is not visible to caller', async () => {
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
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(404)
  })

  test('returns 404 when comment is not found on the project', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const commentsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(404)
  })

  test('returns 403 when a client tries to delete another user comment', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const commentsChain = createChainMock({
      data: { id: 'c-1', author_id: 'someone-else' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'u@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_comments: commentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(403)
    expect(commentsChain.delete).not.toHaveBeenCalled()
  })

  test('returns 409 when replies block the delete (FK violation 23503)', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const commentsChain = createChainMock()
    const attachmentsChain = createChainMock({ data: [], error: null })
    // First `.single()` resolves the comment row; the chain is reused for the
    // subsequent delete/select, so override behaviour per call.
    commentsChain.single.mockResolvedValueOnce({
      data: { id: 'c-1', author_id: 'someone' },
      error: null,
    })
    commentsChain.select.mockReturnValueOnce(commentsChain)
    commentsChain.select.mockReturnValueOnce(commentsChain)
    // Simulate the delete() chain resolving with an FK error via then().
    Object.assign(commentsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { code: '23503', message: 'FK' } }),
    })

    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 's@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_comments: commentsChain,
        project_comment_attachments: attachmentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/replies/i)
  })

  test('returns 403 when RLS silently drops the delete (zero rows)', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const commentsChain = createChainMock()
    const attachmentsChain = createChainMock({ data: [], error: null })
    commentsChain.single.mockResolvedValueOnce({
      data: { id: 'c-1', author_id: 'user-1' },
      error: null,
    })
    Object.assign(commentsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null }),
    })

    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'u@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_comments: commentsChain,
        project_comment_attachments: attachmentsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(403)
  })

  test('removes attachment storage objects then returns 204 on success', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    const profileChain = createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
    const commentsChain = createChainMock()
    const attachmentsChain = createChainMock({
      data: [
        { storage_path: 'a/b/c/one.png' },
        { storage_path: 'a/b/c/two.png' },
      ],
      error: null,
    })
    commentsChain.single.mockResolvedValueOnce({
      data: { id: 'c-1', author_id: 'someone' },
      error: null,
    })
    Object.assign(commentsChain, {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ id: 'c-1' }], error: null }),
    })
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })

    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 's@test.com' },
      fromMocks: {
        projects: projectsChain,
        profiles: profileChain,
        project_comments: commentsChain,
        project_comment_attachments: attachmentsChain,
      },
      storageMocks: { 'project-uploads': { remove: removeMock } },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1', 'c-1'))
    expect(res.status).toBe(204)
    expect(removeMock).toHaveBeenCalledWith([
      'a/b/c/one.png',
      'a/b/c/two.png',
    ])
  })
})
