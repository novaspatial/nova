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

describe('GET /api/portal/projects/[id]/payment-status', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))
    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when the caller does not own the project', async () => {
    const projectsChain = createChainMock({
      data: null,
      error: null,
    })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-other',
        status: 'pending_payment',
        paid_at: null,
        stripe_payment_intent_id: 'pi_1',
        client_deleted_at: null,
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
      }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(404)
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
  })

  test('returns paid:true without calling Stripe when paid_at is set', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        status: 'uploading',
        paid_at: '2026-04-22T00:00:00Z',
        stripe_payment_intent_id: 'pi_1',
        client_deleted_at: null,
      },
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
      }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
    expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled()
  })

  test('claims via Stripe retrieve when intent has succeeded', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          status: 'pending_payment',
          paid_at: null,
          stripe_payment_intent_id: 'pi_1',
          client_deleted_at: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'uploading', paid_at: '2026-04-22T00:00:00Z' },
        error: null,
      })
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      metadata: { user_id: 'user-1' },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
      }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'uploading' }),
    )
    const body = await res.json()
    expect(body).toEqual({ paid: true, status: 'uploading' })
  })

  test('does not update when the intent is still pending', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        status: 'pending_payment',
        paid_at: null,
        stripe_payment_intent_id: 'pi_1',
        client_deleted_at: null,
      },
      error: null,
    })
    mockPaymentIntentsRetrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'requires_payment_method',
      metadata: { user_id: 'user-1' },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
      }),
    )

    const res = await GET(req(), makeParams('proj-1'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body).toEqual({ paid: false, status: 'pending_payment' })
  })
})
