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

import { DELETE, GET, PATCH } from './route'

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

  test('falls back to empty arrays when related queries fail', async () => {
    const projectsChain = createChainMock({
      data: { id: 'proj-1', title: 'Test', status: 'review' },
      error: null,
    })
    const filesChain = createChainMock({
      data: null,
      error: { message: 'Files lookup failed' },
    })
    const commentsChain = createChainMock({
      data: [],
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
    await expect(res.json()).resolves.toEqual({
      id: 'proj-1',
      title: 'Test',
      status: 'review',
      files: [],
      comments: [],
      deliverables: [],
    })
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
    const projectsChain = createChainMock({
      data: { id: 'proj-1' },
      error: null,
    })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
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
    projectsChain.single
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
      .mockResolvedValueOnce({
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

  test('returns 500 when project update fails', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: null,
      error: { message: 'Update failed' },
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
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

    const req = createMockRequest({ status: 'approved' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Update failed' })
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
      projectsChain.single
        .mockResolvedValueOnce({
          data: { id: 'proj-1' },
          error: null,
        })
        .mockResolvedValueOnce({
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

describe('DELETE /api/portal/projects/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 403 when a client tries to delete another user project', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', owner_id: 'owner-2' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  test('hides an owned project from the client view', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        client_deleted_at: null,
        studio_deleted_at: null,
      },
      error: null,
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          client_deleted_at: null,
          studio_deleted_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const deliverablesBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
        'project-deliverables': deliverablesBucket,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      hidden: true,
      deleted: false,
    })
    expect(projectsChain.update).toHaveBeenCalledTimes(1)
    expect(projectsChain.delete).not.toHaveBeenCalled()
    expect(uploadsBucket.remove).not.toHaveBeenCalled()
    expect(deliverablesBucket.remove).not.toHaveBeenCalled()
  })

  test('allows studio users to hide any project from their own view', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'client-1',
        client_deleted_at: null,
        studio_deleted_at: null,
      },
      error: null,
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'client-1',
          client_deleted_at: null,
          studio_deleted_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      hidden: true,
      deleted: false,
    })
    expect(projectsChain.update).toHaveBeenCalledTimes(1)
    expect(projectsChain.delete).not.toHaveBeenCalled()
  })

  test('fully deletes a project when both sides have removed it', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        client_deleted_at: null,
        studio_deleted_at: '2026-03-14T00:00:00.000Z',
      },
      error: null,
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          client_deleted_at: null,
          studio_deleted_at: '2026-03-14T00:00:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
    const filesChain = createChainMock({
      data: [{ storage_path: 'user-1/proj-1/stems.wav' }],
      error: null,
    })
    const deliverablesChain = createChainMock({
      data: [{ storage_path: 'user-1/proj-1/final.wav' }],
      error: null,
    })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const deliverablesBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
        deliverables: deliverablesChain,
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
        'project-deliverables': deliverablesBucket,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      hidden: false,
      deleted: true,
    })
    expect(projectsChain.delete).toHaveBeenCalledTimes(1)
    expect(uploadsBucket.remove).toHaveBeenCalledWith([
      'user-1/proj-1/stems.wav',
    ])
    expect(deliverablesBucket.remove).toHaveBeenCalledWith([
      'user-1/proj-1/final.wav',
    ])
  })

  test('returns 500 when file cleanup lookup fails during final delete', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        client_deleted_at: null,
        studio_deleted_at: '2026-03-14T00:00:00.000Z',
      },
      error: null,
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          client_deleted_at: null,
          studio_deleted_at: '2026-03-14T00:00:00.000Z',
        },
        error: null,
      })
    const filesChain = createChainMock({
      data: null,
      error: { message: 'Files lookup failed' },
    })
    const deliverablesChain = createChainMock({
      data: [],
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
        deliverables: deliverablesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Files lookup failed',
    })
  })

  test('returns 500 when no project row is actually deleted after both sides removed it', async () => {
    const profileChain = createChainMock({
      data: { role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        client_deleted_at: null,
        studio_deleted_at: '2026-03-14T00:00:00.000Z',
      },
      error: null,
    })
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          client_deleted_at: null,
          studio_deleted_at: '2026-03-14T00:00:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      })
    const filesChain = createChainMock({
      data: [],
      error: null,
    })
    const deliverablesChain = createChainMock({
      data: [],
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
        deliverables: deliverablesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Project could not be deleted. Ensure delete policies are applied.',
    })
  })
})
