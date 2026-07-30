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

// The catalog-hold restore runs on the service client (#26); tests that
// don't set a return value exercise the no-service-key skip path.
const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

// The status notification runs for real in these tests (its best-effort
// contract is the thing #49 fixed) — only Resend itself is stubbed.
const mockResendSend = vi
  .fn()
  .mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: (...args: unknown[]) => mockResendSend(...args) } },
  RESEND_FROM: 'Atmos <noreply@example.com>',
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

  test('returns project with files and comments', async () => {
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

    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_files: filesChain,
        project_comments: commentsChain,
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

    const supabase = createSupabaseMock({
      fromMocks: {
        projects: projectsChain,
        project_files: filesChain,
        project_comments: commentsChain,
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

  test('a throwing notification does not 500 a committed status change (#49)', async () => {
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
        data: { id: 'proj-1', status: 'review' },
        error: null,
      })
      // The notification's own project/owner lookup.
      .mockResolvedValueOnce({
        data: { title: 'T', owner: { email: 'client@test.com', display_name: null } },
        error: null,
      })
    projectsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'approved' },
      error: null,
    })
    mockResendSend.mockRejectedValueOnce(new Error('Resend is down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: 'approved' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    errSpy.mockRestore()
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
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({
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
    expect(projectsChain.eq).toHaveBeenCalledWith('status', 'review')
  })

  test('stamps delivered_at when transitioning into delivered', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'delivered' },
      error: null,
    })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'delivered' },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: 'delivered' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'delivered',
        delivered_at: expect.any(String),
      }),
    )
  })

  test('leaves delivered_at alone on non-delivery transitions', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: 'approved' },
      error: null,
    })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({
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

    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ delivered_at: expect.anything() }),
    )
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
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({
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

  test.each([
    ['uploading', 'in_review'],
    ['in_review', 'mixing'],
    ['processing', 'review'],
    ['mixing', 'review'],
    ['review', 'revision'],
    ['review', 'approved'],
    ['review', 'delivered'],
    ['revision', 'review'],
    ['revision', 'delivered'],
    ['approved', 'delivered'],
  ])('accepts the legal studio transition %s → %s', async (from, to) => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({
      data: { id: 'proj-1', status: to },
      error: null,
    })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: from },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'proj-1', status: to },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: to })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)
  })

  test.each([
    ['delivered', 'uploading'],
    ['delivered', 'in_review'],
    ['uploading', 'delivered'],
    ['review', 'review'],
    ['mixing', 'processing'],
    ['review', 'pending_payment'],
  ])('returns 400 for the illegal transition %s → %s', async (from, to) => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: from },
      error: null,
    })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: to })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe(`Cannot change status from ${from} to ${to}`)
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('returns 409 when the status changed concurrently', async () => {
    const profileChain = createChainMock({
      data: { role: 'studio' },
      error: null,
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.single.mockResolvedValueOnce({
      data: { id: 'proj-1', status: 'review' },
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ status: 'approved' })
    const res = await PATCH(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(409)

    const body = await res.json()
    expect(body.error).toBe('Project status changed concurrently. Reload and retry.')
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

  test('owner (client role) fully deletes an unpaid project', async () => {
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
        discount_applied: false,
        paid_at: null,
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
          discount_applied: false,
          paid_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
    const filesChain = createChainMock({ data: [], error: null })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
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
  })

  test('refuses a client delete of a paid project (#48)', async () => {
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
        paid_at: '2026-04-01T00:00:00.000Z',
      },
      error: null,
    })
    const filesChain = createChainMock({ data: [], error: null })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: { 'project-uploads': uploadsBucket },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(403)
    // Nothing destroyed: no row delete, no storage sweep.
    expect(projectsChain.delete).not.toHaveBeenCalled()
    expect(uploadsBucket.remove).not.toHaveBeenCalled()
  })

  test('sweeps storage only after the row delete succeeds (#48)', async () => {
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
        discount_applied: false,
        paid_at: null,
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
          discount_applied: false,
          paid_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'delete refused' },
      })
    const filesChain = createChainMock({
      data: [{ storage_path: 'user-1/proj-1/stem.wav' }],
      error: null,
    })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: { 'project-uploads': uploadsBucket },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    // The row survived, so its audio must survive with it.
    expect(uploadsBucket.remove).not.toHaveBeenCalled()
  })

  test('studio role can delete any project', async () => {
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
        discount_applied: false,
        paid_at: '2026-04-01T00:00:00.000Z',
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
          discount_applied: false,
          paid_at: '2026-04-01T00:00:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'proj-1' },
        error: null,
      })
    const filesChain = createChainMock({ data: [], error: null })
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
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
  })

  test('restores first-mix discount when the project was reserved but never paid', async () => {
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
        discount_applied: true,
        paid_at: null,
      },
      error: null,
    })
    // The restore keys off the DELETE-RETURNING row (#26 exactly-once), so
    // the second single (the delete) must carry the payment flags.
    projectsChain.single
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          client_deleted_at: null,
          studio_deleted_at: null,
          discount_applied: true,
          paid_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          discount_applied: true,
          paid_at: null,
          applied_coupon_code: null,
        },
        error: null,
      })
    const filesChain = createChainMock({ data: [], error: null })
    const rpcMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      rpc: rpcMock,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith('restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })

  test('restores a catalog-code hold on the service client when unpaid (#26)', async () => {
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
        discount_applied: false,
        paid_at: null,
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
          discount_applied: false,
          paid_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          discount_applied: false,
          paid_at: null,
          applied_coupon_code: 'SUMMER10',
        },
        error: null,
      })
    const filesChain = createChainMock({ data: [], error: null })
    const sessionRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      rpc: sessionRpc,
    })
    mockCreateClient.mockResolvedValue(supabase)
    mockCreateServiceClient.mockReturnValue(
      createSupabaseMock({ rpc: serviceRpc }),
    )

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    expect(serviceRpc).toHaveBeenCalledWith('restore_discount_code', {
      p_code: 'SUMMER10',
    })
    // The session client restores only the flag path; a code order has none.
    expect(sessionRpc).not.toHaveBeenCalled()
  })

  test.each([
    [
      'a WELCOME row (the delete itself frees the index slot)',
      { applied_coupon_code: 'WELCOME', paid_at: null },
      'client',
    ],
    [
      // Since #48 only studio may delete a paid row at all; the point of
      // the case is that a consumed code is not returned either way.
      'a paid code order (consumed, not restorable)',
      { applied_coupon_code: 'SUMMER10', paid_at: '2026-07-01T00:00:00.000Z' },
      'studio',
    ],
  ])('does not restore %s', async (_label, returned, role) => {
    const profileChain = createChainMock({
      data: { role },
      error: null,
    })
    const projectsChain = createChainMock({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        client_deleted_at: null,
        studio_deleted_at: null,
        discount_applied: false,
        paid_at: returned.paid_at,
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
          discount_applied: false,
          paid_at: returned.paid_at,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          discount_applied: false,
          ...returned,
        },
        error: null,
      })
    const filesChain = createChainMock({ data: [], error: null })
    const serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)
    mockCreateServiceClient.mockReturnValue(
      createSupabaseMock({ rpc: serviceRpc }),
    )

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  test('a delete that removes no row restores nothing (concurrent duplicate)', async () => {
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
        discount_applied: true,
        paid_at: null,
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
          discount_applied: true,
          paid_at: null,
        },
        error: null,
      })
      // The concurrent duplicate lost the delete CAS: no row came back.
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned' },
      })
    const filesChain = createChainMock({ data: [], error: null })
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      rpc: rpcMock,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(500)
    expect(rpcMock).not.toHaveBeenCalled()
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
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
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
  })

  test('sweeps comment-attachment storage objects alongside files on delete', async () => {
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
        discount_applied: false,
        paid_at: '2026-04-01T00:00:00.000Z',
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
          discount_applied: false,
          paid_at: '2026-04-01T00:00:00.000Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: 'proj-1' }, error: null })
    const filesChain = createChainMock({
      data: [{ storage_path: 'client-1/proj-1/stems.wav' }],
      error: null,
    })
    const attachmentsChain = createChainMock({
      data: [{ storage_path: 'client-1/proj-1/comments/c1/note.png' }],
      error: null,
    })
    const uploadsBucket = {
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const supabase = createSupabaseMock({
      user: { id: 'studio-1', email: 'studio@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
        project_comment_attachments: attachmentsChain,
      },
      storageMocks: {
        'project-uploads': uploadsBucket,
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest(undefined, { method: 'DELETE' })
    const res = await DELETE(req as NextRequest, makeParams('proj-1'))

    expect(res.status).toBe(200)
    expect(uploadsBucket.remove).toHaveBeenCalledWith([
      'client-1/proj-1/stems.wav',
      'client-1/proj-1/comments/c1/note.png',
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
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
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
    const supabase = createSupabaseMock({
      user: { id: 'user-1', email: 'client@test.com' },
      fromMocks: {
        profiles: profileChain,
        projects: projectsChain,
        project_files: filesChain,
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
