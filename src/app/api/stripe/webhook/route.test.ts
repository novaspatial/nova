import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createChainMock } from '@/test/helpers/supabaseMock'

const mockConstructEvent = vi.fn()
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
}))

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { POST } from './route'

function buildRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  }) as unknown as import('next/server').NextRequest
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  test('rejects missing stripe-signature with 400', async () => {
    const res = await POST(buildRequest('{}', null))
    expect(res.status).toBe(400)
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  test('rejects bad signature with 400 and no DB work', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Signature invalid')
    })
    const res = await POST(buildRequest('{}', 'sig_bad'))
    expect(res.status).toBe(400)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('ignores unrelated event types and returns 200', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: { object: { id: 'ch_1' } },
    })
    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('marks project paid on payment_intent.succeeded', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-1', project_id: 'proj-1' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    // Two maybeSingle terminals: the project load, then the claim write.
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          status: 'pending_payment',
          paid_at: null,
          stripe_payment_intent_id: 'pi_1',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: 'uploading' }, error: null })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'uploading',
        paid_at: expect.any(String),
      }),
    )
    expect(projectsChain.eq).toHaveBeenCalledWith('id', 'proj-1')
    expect(projectsChain.is).toHaveBeenCalledWith('paid_at', null)
  })

  test('returns 500 when the claim write fails so Stripe retries', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-1', project_id: 'proj-1' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          status: 'pending_payment',
          paid_at: null,
          stripe_payment_intent_id: 'pi_1',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'update failed' },
      })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(500)
    mockConsoleError.mockRestore()
  })

  test('replay on already-paid project is a no-op', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-1', project_id: 'proj-1' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        status: 'uploading',
        paid_at: '2026-04-22T00:00:00Z',
        stripe_payment_intent_id: 'pi_1',
      },
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('records paid_at without touching status when the project already advanced', async () => {
    const mockConsoleWarn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-1', project_id: 'proj-1' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'proj-1',
          owner_id: 'user-1',
          status: 'in_review',
          paid_at: null,
          stripe_payment_intent_id: 'pi_1',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: 'in_review' }, error: null })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    )
    expect(projectsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ paid_at: expect.any(String) }),
    )
    expect(projectsChain.is).toHaveBeenCalledWith('paid_at', null)
    expect(mockConsoleWarn).toHaveBeenCalled()
    mockConsoleWarn.mockRestore()
  })

  test('metadata user_id mismatch does not update', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-hacker', project_id: 'proj-1' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        status: 'pending_payment',
        paid_at: null,
        stripe_payment_intent_id: 'pi_1',
      },
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).not.toHaveBeenCalled()
  })

  test('metadata project_id mismatch does not update', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { user_id: 'user-1', project_id: 'proj-other' },
        },
      },
    })
    const projectsChain = createChainMock({ data: null, error: null })
    projectsChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'proj-1',
        owner_id: 'user-1',
        status: 'pending_payment',
        paid_at: null,
        stripe_payment_intent_id: 'pi_1',
      },
      error: null,
    })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => projectsChain),
    })

    const res = await POST(buildRequest('{}', 'sig_ok'))
    expect(res.status).toBe(200)
    expect(projectsChain.update).not.toHaveBeenCalled()
    mockConsoleError.mockRestore()
  })
})
