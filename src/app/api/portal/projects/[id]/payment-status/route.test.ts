import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

const mockPaymentIntentsRetrieve = vi.fn()
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    paymentIntents: { retrieve: mockPaymentIntentsRetrieve },
  }),
}))

import { GET } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function req() {
  return new Request('http://localhost:3000', {
    method: 'GET',
  }) as unknown as NextRequest
}

function pendingProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    owner_id: 'user-1',
    status: 'pending_payment',
    paid_at: null,
    stripe_payment_intent_id: 'pi_1',
    client_deleted_at: null,
    song_count: 1,
    applied_coupon_code: null,
    ...overrides,
  }
}

function succeededIntent(metadata: Record<string, string>) {
  return { id: 'pi_1', status: 'succeeded', metadata }
}

describe('GET /api/portal/projects/[id]/payment-status', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))
    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when the caller does not own the project', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({ owner_id: 'user-other' }),
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(404)
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
  })

  test('returns paid:true without calling Stripe when paid_at is set', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({
        status: 'uploading',
        paid_at: '2026-04-22T00:00:00Z',
      }),
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('claims on the service client when the intent has succeeded', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: { status: 'uploading' },
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    // The claim is a system write: service chain only, never the session.
    expect(serviceProjectsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'uploading',
        paid_at: expect.any(String),
      }),
    )
    expect(serviceProjectsChain.eq).toHaveBeenCalledWith('id', 'proj-1')
    expect(serviceProjectsChain.is).toHaveBeenCalledWith('paid_at', null)
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('claims when best-effort metadata (project_id) is absent', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: { status: 'uploading' },
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({ user_id: 'user-1', song_count: '1' }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
  })

  test('returns 404 and never claims on metadata user_id mismatch', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-other',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(404)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('returns 404 and never claims when the intent belongs to another project', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-deleted-original',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(404)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('refuses the claim on inflated metadata song_count mismatch', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({ song_count: 8 }),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({ user_id: 'user-1', song_count: '1' }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    mockConsoleError.mockRestore()
  })

  test('fails closed when a re-attached intent has song_count but the row nulls it', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const projectsChain = createChainMock()
    // Forged re-attach: song_count omitted (nullable, unpinned by the fence).
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({ song_count: null }),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({ user_id: 'user-1', song_count: '1' }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    mockConsoleError.mockRestore()
  })

  test('returns paid:false when the service client is unavailable', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
    mockConsoleError.mockRestore()
  })

  test('returns paid:false when the claim write fails', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'update failed' },
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
    mockConsoleError.mockRestore()
  })

  test('re-reads as the caller when the webhook won the claim race', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: pendingProjectRow(),
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'uploading', paid_at: '2026-07-08T00:00:00Z' },
        error: null,
      })
    const serviceProjectsChain = createChainMock()
    // CAS lost: the fenced update matched no row.
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
  })

  test('does not update when the intent is still pending', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow(),
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'requires_payment_method',
      metadata: { user_id: 'user-1', project_id: 'proj-1', song_count: '1' },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).not.toHaveBeenCalled()
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
  })

  // --- #26 (D6): the poll finalizes consumption best-effort. ---

  test('finalizes consumption after winning the claim on a code order', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({ applied_coupon_code: 'SUMMER10' }),
      error: null,
    })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: { status: 'uploading' },
      error: null,
    })
    const serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
      rpc: serviceRpc,
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    expect(serviceRpc).toHaveBeenCalledWith('consume_discount_code', {
      p_project_id: 'proj-1',
    })
  })

  test('a failed consume never blocks the paid:true answer', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({ applied_coupon_code: 'SUMMER10' }),
      error: null,
    })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: { status: 'uploading' },
      error: null,
    })
    const serviceRpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'consume failed' } })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
      rpc: serviceRpc,
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    // Payment is a fact; the webhook's 500-retry loop is the durable
    // finalizer for the consume.
    expect(body).toEqual({ paid: true, status: 'uploading' })
    expect(mockConsoleError).toHaveBeenCalled()
    mockConsoleError.mockRestore()
  })

  test('finalizes consumption even when the webhook won the claim race', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: pendingProjectRow({ applied_coupon_code: 'SUMMER10' }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'uploading', paid_at: '2026-07-15T00:00:00Z' },
        error: null,
      })
    const serviceProjectsChain = createChainMock()
    serviceProjectsChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })
    const serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockPaymentIntentsRetrieve.mockResolvedValue(
      succeededIntent({
        user_id: 'user-1',
        project_id: 'proj-1',
        song_count: '1',
      }),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
      rpc: serviceRpc,
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    // Idempotent per project — safe alongside the webhook's own finalize.
    expect(serviceRpc).toHaveBeenCalledWith('consume_discount_code', {
      p_project_id: 'proj-1',
    })
  })

  test('the paid early-return re-attempts consumption for a code order', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({
        status: 'uploading',
        paid_at: '2026-07-15T00:00:00Z',
        applied_coupon_code: 'SUMMER10',
      }),
      error: null,
    })
    const serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => createChainMock()),
      rpc: serviceRpc,
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
    // Recovers a claim that landed without its consume (webhook-less dev).
    expect(serviceRpc).toHaveBeenCalledWith('consume_discount_code', {
      p_project_id: 'proj-1',
    })
  })

  test('the paid early-return answers even without a service key', async () => {
    const projectsChain = createChainMock()
    projectsChain.maybeSingle.mockResolvedValue({
      data: pendingProjectRow({
        status: 'uploading',
        paid_at: '2026-07-15T00:00:00Z',
        applied_coupon_code: 'SUMMER10',
      }),
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })

    const res = await GET(req(), makeParams('proj-1'))
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
  })
})
