import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import { TERMS_VERSION } from '@/lib/legal/terms'
import type { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

const mockPaymentIntentsCreate = vi.fn()
const mockPaymentIntentsUpdate = vi.fn()
const mockPaymentIntentsCancel = vi.fn()
const mockGetStripe = vi.fn()
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => mockGetStripe(),
}))

import { POST } from './route'

function makeProjectsChain(opts: {
  pendingCount?: number
  insertResult?: { data: { id: string } | null; error: { message: string } | null }
}) {
  const pendingCount = opts.pendingCount ?? 0
  const insertResult = opts.insertResult ?? {
    data: { id: 'proj-new' },
    error: null,
  }
  const chain = createChainMock({ count: pendingCount, error: null })
  chain.single.mockResolvedValue(insertResult)
  return chain
}

function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Album',
    format: 'atmos',
    songCount: 1,
    stemCount: 12,
    // US default keeps the pre-tax cent amounts of the existing vectors;
    // the taxed (CA) paths get their own tests.
    billingCountry: 'US',
    termsAcceptedVersion: TERMS_VERSION,
    ...overrides,
  }
}

describe('POST /api/portal/projects/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStripe.mockReturnValue({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
        update: mockPaymentIntentsUpdate,
        cancel: mockPaymentIntentsCancel,
      },
    })
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret',
    })
    mockPaymentIntentsUpdate.mockResolvedValue({ id: 'pi_test_123' })
    mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_test_123' })
  })

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))
    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('returns 400 when title is missing', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ title: undefined }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -3],
    ['fractional', 2.5],
    ['above the cap', 100],
    ['non-numeric', 'five'],
  ])('returns 400 when songCount is %s', async (_label, songCount) => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ songCount }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test.each([
    ['missing', undefined],
    ['zero', 0],
    ['fractional', 3.5],
  ])('returns 400 when stemCount is %s', async (_label, stemCount) => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ stemCount }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test('returns 400 when format is not a valid service', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ format: 'stereo' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test('returns 400 when stemCount exceeds the cap', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ stemCount: 1000 }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test('returns 400 when notes or reference tracks exceed the length cap', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const long = 'x'.repeat(5001)
    for (const overrides of [{ notes: long }, { referenceTracks: long }]) {
      const req = createMockRequest(orderBody(overrides))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(400)
    }
  })

  test.each([
    ['missing', undefined],
    ['a stale version', '1999-01-01'],
    ['non-string', true],
  ])(
    'returns 400 when termsAcceptedVersion is %s',
    async (_label, termsAcceptedVersion) => {
      mockCreateClient.mockResolvedValue(createSupabaseMock())
      const req = createMockRequest(orderBody({ termsAcceptedVersion }))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(400)
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    },
  )

  test.each([
    ['missing', undefined],
    ['not in the allowlist', 'DE'],
    ['lowercase', 'ca'],
    ['non-string', 42],
  ])('returns 400 when billingCountry is %s', async (_label, billingCountry) => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req = createMockRequest(orderBody({ billingCountry }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Select a billing country')
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test.each([
    ['missing', undefined],
    ['not a province code', 'ONT'],
    ['lowercase', 'on'],
    ['non-string', 13],
  ])(
    'returns 400 when billingCountry is CA and billingProvince is %s',
    async (_label, billingProvince) => {
      const rpc = vi.fn()
      mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))
      const req = createMockRequest(
        orderBody({ billingCountry: 'CA', billingProvince }),
      )
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Select a province or territory')
      // Rejected before any side effect: no intent, no discount reservation.
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  test('defaults the format when absent and nulls a non-string referenceTracks', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(
      orderBody({ format: undefined, referenceTracks: 42 }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'atmos', reference_tracks: null }),
    )
  })

  test('returns 500 before reserving the discount when Stripe is not configured', async () => {
    mockGetStripe.mockImplementationOnce(() => {
      throw new Error('STRIPE_SECRET_KEY missing')
    })
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: makeProjectsChain({}) }, rpc }),
    )

    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    // The reservation must never fire — a throw here would otherwise burn it.
    expect(rpc).not.toHaveBeenCalled()
  })

  test('creates the intent with redirect-based payment methods disabled', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: makeProjectsChain({}) }, rpc }),
    )

    const req = createMockRequest(orderBody())
    await POST(req as NextRequest)
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      }),
    )
  })

  test('charges the single-song list price when no discount applies', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(
      orderBody({ referenceTracks: 'Track A — Artist B' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 32500, currency: 'usd' }),
    )
    const body = await res.json()
    expect(body).toMatchObject({
      projectId: 'proj-new',
      clientSecret: 'pi_test_123_secret',
      amountCents: 32500,
      currency: 'usd',
      discountApplied: false,
      breakdown: {
        song_count: 1,
        list_total_cents: 32500,
        bulk_discount_cents: 0,
        code_discount_cents: 0,
        subtotal_cents: 32500,
        total_cents: 32500,
      },
    })
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending_payment',
        stripe_payment_intent_id: 'pi_test_123',
        format: 'atmos',
        amount_cents: 32500,
        song_count: 1,
        stem_count: 12,
        subtotal_cents: 32500,
        reference_tracks: 'Track A — Artist B',
        discount_applied: false,
        terms_accepted_at: expect.any(String),
        terms_version: TERMS_VERSION,
        tax_cents: 0,
        buyer_country: 'US',
        buyer_province: null,
      }),
    )
    // The client-session insert must be born unpaid or the 20260708 fence
    // 42501s every real checkout: no paid_at, no born-past-pending status.
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ paid_at: expect.anything() }),
    )
    // The Stripe branch stays on the user's session — RLS applies.
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  test('applies the bulk tier on a multi-song order', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    // 5 songs: list 162500, 20% bulk tier -> 130000.
    const req = createMockRequest(
      orderBody({ songCount: 5, stemCount: 60, format: 'both' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 130000, currency: 'usd' }),
    )
    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      song_count: 5,
      list_total_cents: 162500,
      bulk_discount_cents: 32500,
      code_discount_cents: 0,
      subtotal_cents: 130000,
      total_cents: 130000,
    })
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'both',
        amount_cents: 130000,
        song_count: 5,
        stem_count: 60,
        subtotal_cents: 130000,
        reference_tracks: null,
      }),
    )
  })

  test('first-mix reservation rides as the private welcome-percent code', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    // 1 song: the 15% welcome code takes 4875 off list 32500 -> 27625. The
    // $225/song floor (22500) never binds at 15%; floor behavior stays
    // covered by the module vectors in pricing.test.ts (fixed-code floor
    // bound, >100% percent clamp, invariant grid).
    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(rpc).toHaveBeenCalledWith('reserve_first_mix_discount', {
      p_user_id: 'user-1',
    })
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 27625, currency: 'usd' }),
    )
    const body = await res.json()
    expect(body).toMatchObject({
      amountCents: 27625,
      discountApplied: true,
      breakdown: {
        list_total_cents: 32500,
        bulk_discount_cents: 0,
        code_discount_cents: 4875,
        subtotal_cents: 27625,
        total_cents: 27625,
      },
    })
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 27625,
        subtotal_cents: 27625,
        discount_applied: true,
      }),
    )
  })

  test('first-mix private code suppresses the bulk tier on multi-song orders', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    // 8 songs: the private code disables the 25% bulk tier; 15% takes 39000
    // off list 260000 -> 221000 (the floor, 8 x 22500 = 180000, stays clear).
    const req = createMockRequest(orderBody({ songCount: 8, stemCount: 96 }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      song_count: 8,
      list_total_cents: 260000,
      bulk_discount_cents: 0,
      code_discount_cents: 39000,
      subtotal_cents: 221000,
      total_cents: 221000,
    })
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 221000 }),
    )
  })

  test('charges GST/HST on top of the subtotal for a Canadian order', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // 1 song CA-ON: subtotal 32500, HST 13% -> 4225, charge 36725.
    const req = createMockRequest(
      orderBody({ billingCountry: 'CA', billingProvince: 'ON' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 36725,
        currency: 'usd',
        metadata: expect.objectContaining({
          tax_cents: '4225',
          tax_region: 'CA-ON',
        }),
      }),
    )
    const body = await res.json()
    expect(body).toMatchObject({
      amountCents: 36725,
      breakdown: {
        subtotal_cents: 32500,
        tax_cents: 4225,
        tax_rate_pct: 13,
        tax_label: 'HST (13%)',
        total_cents: 36725,
      },
    })
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 36725,
        subtotal_cents: 32500,
        tax_cents: 4225,
        buyer_country: 'CA',
        buyer_province: 'ON',
      }),
    )
    // The post-insert metadata patch carries the same reconciliation fields.
    expect(mockPaymentIntentsUpdate).toHaveBeenCalledWith(
      'pi_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({
          project_id: 'proj-new',
          tax_cents: '4225',
          tax_region: 'CA-ON',
        }),
      }),
    )
  })

  test('taxes the discounted subtotal when the welcome code applies', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // 1 song CA-ON with the 15% welcome code: subtotal 27625, HST 3591
    // (3591.25 rounds down), charge 31216 — tax follows the actual
    // consideration, not the list price.
    const req = createMockRequest(
      orderBody({ billingCountry: 'CA', billingProvince: 'ON' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toMatchObject({
      amountCents: 31216,
      discountApplied: true,
      breakdown: {
        code_discount_cents: 4875,
        subtotal_cents: 27625,
        tax_cents: 3591,
        total_cents: 31216,
      },
    })
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 31216 }),
    )
  })

  test('force-nulls a stray province on a non-Canadian order', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(
      orderBody({ billingCountry: 'US', billingProvince: 'ON' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(projectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_cents: 0,
        buyer_country: 'US',
        buyer_province: null,
      }),
    )
  })

  test('returns 429 when the user has too many recent pending checkouts', async () => {
    const projectsChain = makeProjectsChain({ pendingCount: 3 })
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(429)
    expect(rpc).not.toHaveBeenCalled()
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('cancels the intent and restores the reservation when insert fails', async () => {
    const projectsChain = makeProjectsChain({
      insertResult: { data: null, error: { message: 'db down' } },
    })
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)

    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_test_123')
    expect(rpc).toHaveBeenNthCalledWith(2, 'restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })

  test('dev bypass skips Stripe and stores the real quote on a $0 project', async () => {
    const projectsChain = makeProjectsChain({})
    const serviceProjectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      // CA-ON so the bypass proves the real quote keeps its tax fields:
      // 3 songs bulk-discounted to 82875, HST 13% -> 10774 (10773.75 rounds
      // up) — while the charge stays $0.
      const req = createMockRequest(
        orderBody({
          songCount: 3,
          stemCount: 30,
          referenceTracks: 'Ref X',
          billingCountry: 'CA',
          billingProvince: 'ON',
        }),
      )
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toMatchObject({
        projectId: 'proj-new',
        devBypass: true,
        clientSecret: null,
        amountCents: 0,
        currency: 'usd',
        breakdown: {
          song_count: 3,
          list_total_cents: 97500,
          bulk_discount_cents: 14625,
          subtotal_cents: 82875,
          tax_cents: 10774,
          total_cents: 93649,
        },
      })
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
      // The born-paid insert is a system write: service client, not the
      // session — the 20260708 insert fence rejects the latter.
      expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: 'user-1',
          status: 'uploading',
          amount_cents: 0,
          paid_at: expect.any(String),
          song_count: 3,
          stem_count: 30,
          subtotal_cents: 82875,
          tax_cents: 10774,
          buyer_country: 'CA',
          buyer_province: 'ON',
          reference_tracks: 'Ref X',
          discount_applied: false,
          terms_accepted_at: expect.any(String),
          terms_version: TERMS_VERSION,
        }),
      )
      expect(projectsChain.insert).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })

  test('dev bypass returns 500 before reserving when the service client is unavailable', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      const req = createMockRequest(orderBody())
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(500)
      // The pre-flight throw must land before the reservation so the
      // one-shot discount is never burned.
      expect(rpc).not.toHaveBeenCalled()
      expect(projectsChain.insert).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })

  test('dev bypass restores the reservation when the insert fails', async () => {
    const projectsChain = makeProjectsChain({})
    const serviceProjectsChain = makeProjectsChain({
      insertResult: { data: null, error: { message: 'insert failed' } },
    })
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn(() => serviceProjectsChain),
    })
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      const req = createMockRequest(orderBody())
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(500)
      // The restore rides the user's own session, not the service client.
      expect(rpc).toHaveBeenNthCalledWith(2, 'restore_first_mix_discount', {
        p_user_id: 'user-1',
      })
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })

  test('restores the reservation when Stripe intent creation fails', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockPaymentIntentsCreate.mockRejectedValueOnce(new Error('stripe error'))
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(502)
    expect(projectsChain.insert).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenNthCalledWith(2, 'restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })
})
