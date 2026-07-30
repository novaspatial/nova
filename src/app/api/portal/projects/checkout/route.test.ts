import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import { TERMS_VERSION } from '@/lib/legal/terms'
import { computeOrderPrice, WELCOME_DISCOUNT_PCT } from '@/lib/stripe/pricing'
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

const mockSendOrderConfirmation = vi.fn()
vi.mock('@/lib/email/orderConfirmation', () => ({
  sendOrderConfirmationEmail: (...args: unknown[]) =>
    mockSendOrderConfirmation(...args),
}))

import { POST } from './route'

function makeProjectsChain(opts: {
  pendingCount?: number
  insertResult?: {
    data: { id: string } | null
    error: { message: string; code?: string } | null
  }
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

/** One active catalog row as `lookup_discount_code` returns it. */
function catalogRow(overrides: Record<string, unknown> = {}) {
  return {
    code: 'SUMMER10',
    kind: 'percent',
    value: 10,
    is_public: true,
    single_use: false,
    usage_limit: null,
    new_clients_only: false,
    returning_clients_only: false,
    active: true,
    expires_at: null,
    ...overrides,
  }
}

// The single supabase rpc mock serves every RPC name — dispatch on the name
// so the catalog lookup and the first-mix reserve/restore can't shadow each
// other.
function lookupRpc(result: {
  data: unknown
  error: { message: string } | null
}) {
  return vi.fn((fn: string) =>
    Promise.resolve(
      fn === 'lookup_discount_code' ? result : { data: null, error: null },
    ),
  )
}

describe('POST /api/portal/projects/checkout', () => {
  // The service client carries the catalog-code holds (#26) and, since the
  // 20260726 fence (#42/#43), EVERY projects insert. Its rpc dispatches by
  // name (reserve defaults to a won CAS) and its projects chain defaults to
  // a good insert; tests customize either by reassigning
  // serviceProjectsChain before POST (the beforeEach implementation reads
  // it at call time) or by overriding mockCreateServiceClient.
  let serviceRpc: ReturnType<typeof vi.fn>
  let serviceProjectsChain: ReturnType<typeof makeProjectsChain>

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
    serviceRpc = vi.fn((fn: string) =>
      Promise.resolve(
        fn === 'reserve_discount_code'
          ? { data: true, error: null }
          : { data: null, error: null },
      ),
    )
    serviceProjectsChain = makeProjectsChain({})
    mockCreateServiceClient.mockImplementation(() =>
      createSupabaseMock({
        fromMocks: { projects: serviceProjectsChain },
        rpc: serviceRpc,
      }),
    )
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
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
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

  test('returns 500 before any side effect when the service client is unavailable', async () => {
    const rpc = vi.fn()
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: makeProjectsChain({}) }, rpc }),
    )

    const req = createMockRequest(orderBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    // Since 20260726 every checkout inserts on the service client — the
    // throw must land before the reservation and before any intent exists.
    expect(rpc).not.toHaveBeenCalled()
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
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
    // No code: the conditional metadata key is omitted entirely, never "null".
    expect(
      mockPaymentIntentsCreate.mock.calls[0][0].metadata,
    ).not.toHaveProperty('applied_coupon_code')
    const body = await res.json()
    expect(body).toMatchObject({
      projectId: 'proj-new',
      clientSecret: 'pi_test_123_secret',
      amountCents: 32500,
      currency: 'usd',
      discountApplied: false,
      appliedCouponCode: null,
      breakdown: {
        song_count: 1,
        list_total_cents: 32500,
        bulk_discount_cents: 0,
        code_discount_cents: 0,
        subtotal_cents: 32500,
        total_cents: 32500,
      },
    })
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        // The service insert bypasses RLS's WITH CHECK — owner_id must
        // still bind to the authenticated session user.
        owner_id: 'user-1',
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
        applied_coupon_code: null,
      }),
    )
    // Born unpaid even as a system write: paid_at belongs to the payment
    // writers (the claimProjectPayment CAS), never the checkout insert.
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ paid_at: expect.anything() }),
    )
    // 20260726 (#42/#43): project rows are born only from system writes —
    // the session client must never insert.
    expect(projectsChain.insert).not.toHaveBeenCalled()
    // The receipt (#24) waits for the payment writers (webhook/poll claim);
    // an unpaid checkout never sends it.
    expect(mockSendOrderConfirmation).not.toHaveBeenCalled()
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
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
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
      // The legacy flag path is code-less: no coupon code rides the order.
      appliedCouponCode: null,
      breakdown: {
        list_total_cents: 32500,
        bulk_discount_cents: 0,
        code_discount_cents: 4875,
        subtotal_cents: 27625,
        total_cents: 27625,
      },
    })
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 27625,
        subtotal_cents: 27625,
        discount_applied: true,
        applied_coupon_code: null,
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
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
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
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_cents: 0,
        buyer_country: 'US',
        buyer_province: null,
      }),
    )
  })

  test('charges and persists both add-ons on top of the list price', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // 1 song 32500 + extra revision 5000 + rush 14900 = 52400 (D4: add-ons
    // after discounts, outside cap/floor; none apply here).
    const req = createMockRequest(
      orderBody({ addOns: ['extra_revision', 'rush_48h'] }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 52400, currency: 'usd' }),
    )
    // Stamped on create AND on the post-insert project_id patch.
    expect(mockPaymentIntentsCreate.mock.calls[0][0].metadata).toMatchObject({
      add_ons: 'extra_revision,rush_48h',
    })
    expect(mockPaymentIntentsUpdate).toHaveBeenCalledWith(
      'pi_test_123',
      expect.objectContaining({
        metadata: expect.objectContaining({
          add_ons: 'extra_revision,rush_48h',
        }),
      }),
    )
    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      add_ons_cents: 19900,
      subtotal_cents: 52400,
      total_cents: 52400,
    })
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        add_ons: ['extra_revision', 'rush_48h'],
        amount_cents: 52400,
        subtotal_cents: 52400,
      }),
    )
  })

  test('taxes the add-on-inclusive subtotal for a Canadian order', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // 1 song 32500 + rush 14900 = 47400; ON HST 13% -> 6162; total 53562 —
    // tax on the whole consideration including add-ons (D2).
    const req = createMockRequest(
      orderBody({
        addOns: ['rush_48h'],
        billingCountry: 'CA',
        billingProvince: 'ON',
      }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 53562 }),
    )
    expect(mockPaymentIntentsCreate.mock.calls[0][0].metadata).toMatchObject({
      add_ons: 'rush_48h',
      tax_cents: '6162',
    })
    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      add_ons_cents: 14900,
      subtotal_cents: 47400,
      tax_cents: 6162,
      total_cents: 53562,
    })
  })

  test('rejects malformed add-ons with 400 before any side effect', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // Non-array and unknown value: the payment boundary rejects loudly,
    // unlike the deep-link parser's silent filtering.
    for (const addOns of ['rush_48h', ['rush_48h', 'gold_vinyl']]) {
      const res = await POST(
        createMockRequest(orderBody({ addOns })) as NextRequest,
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid add-on selection')
    }
    expect(rpc).not.toHaveBeenCalled()
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
  })

  test('de-duplicates add-ons and persists them in canonical order', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // Duplicated rush + calculator click order: charged once each, stored
    // in ADD_ON_VALUES order regardless of submission order.
    const req = createMockRequest(
      orderBody({ addOns: ['rush_48h', 'extra_revision', 'rush_48h'] }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 52400 }),
    )
    expect(mockPaymentIntentsCreate.mock.calls[0][0].metadata).toMatchObject({
      add_ons: 'extra_revision,rush_48h',
    })
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ add_ons: ['extra_revision', 'rush_48h'] }),
    )
  })

  test('an order without add-ons persists [] and stamps empty metadata', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const res = await POST(createMockRequest(orderBody()) as NextRequest)
    expect(res.status).toBe(200)
    // [] (not null — null is reserved for pre-#19 rows), and add_ons is
    // always stamped: '' means "post-#19, none purchased", absent means a
    // pre-#19 intent the payment-status cross-check must skip.
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ add_ons: [] }),
    )
    expect(mockPaymentIntentsCreate.mock.calls[0][0].metadata).toMatchObject({
      add_ons: '',
    })
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
    const projectsChain = makeProjectsChain({})
    serviceProjectsChain = makeProjectsChain({
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
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
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
        appliedCouponCode: null,
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
      // session — the 20260726 fence rejects any client-session insert.
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
          applied_coupon_code: null,
          terms_accepted_at: expect.any(String),
          terms_version: TERMS_VERSION,
        }),
      )
      expect(projectsChain.insert).not.toHaveBeenCalled()
      // Born-paid and webhook-less: the receipt (#24) fires inline, on the
      // service client.
      expect(mockSendOrderConfirmation).toHaveBeenCalledTimes(1)
      expect(mockSendOrderConfirmation).toHaveBeenCalledWith(
        expect.anything(),
        'proj-new',
      )
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })

  test('the bypass is forced off in production env even when the flag is set', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
    const prevBypass = process.env.PAYMENTS_DEV_BYPASS
    const prevVercelEnv = process.env.VERCEL_ENV
    process.env.PAYMENTS_DEV_BYPASS = 'true'
    process.env.VERCEL_ENV = 'production'

    try {
      const req = createMockRequest(orderBody())
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(200)

      // The real Stripe path ran: an intent was created and the row was
      // born unpaid — nothing about the bypass branch executed (#45).
      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const body = await res.json()
      expect(body).toMatchObject({ clientSecret: 'pi_test_123_secret' })
      expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_payment' }),
      )
      expect(mockSendOrderConfirmation).not.toHaveBeenCalled()
    } finally {
      if (prevBypass === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prevBypass
      }
      if (prevVercelEnv === undefined) {
        delete process.env.VERCEL_ENV
      } else {
        process.env.VERCEL_ENV = prevVercelEnv
      }
    }
  })

  test('dev bypass persists add-ons on the $0 project', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      // 1 song 32500 + rush 14900 = 47400 kept on the order fields while the
      // charge stays $0.
      const req = createMockRequest(orderBody({ addOns: ['rush_48h'] }))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.breakdown).toMatchObject({
        add_ons_cents: 14900,
        subtotal_cents: 47400,
        total_cents: 47400,
      })
      expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          add_ons: ['rush_48h'],
          subtotal_cents: 47400,
          amount_cents: 0,
        }),
      )
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
    serviceProjectsChain = makeProjectsChain({
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
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenNthCalledWith(2, 'restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })

  test('redeems a public catalog code stacked with the bulk tier and persists it', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    // Expected total from the same module the route charges with — the
    // acceptance criterion is charge === computeOrderPrice, not a hand sum.
    const expected = computeOrderPrice({
      songCount: 5,
      code: { kind: 'percent', value: 10, scope: 'public' },
      buyer: { country: 'US' },
    })
    const req = createMockRequest(
      orderBody({ songCount: 5, stemCount: 60, code: 'SUMMER10' }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(rpc).toHaveBeenCalledWith('lookup_discount_code', {
      p_code: 'SUMMER10',
    })
    // #26: the redeemed code is held atomically on the service client.
    expect(serviceRpc).toHaveBeenCalledWith('reserve_discount_code', {
      p_code: 'SUMMER10',
    })
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected.total_cents }),
    )
    expect(
      mockPaymentIntentsCreate.mock.calls[0][0].metadata,
    ).toMatchObject({ applied_coupon_code: 'SUMMER10' })
    const body = await res.json()
    expect(body).toMatchObject({
      amountCents: expected.total_cents,
      // Public codes stack with the bulk tier (both discounts non-zero);
      // discount_applied stays the first-mix flag, untouched by a code.
      discountApplied: false,
      appliedCouponCode: 'SUMMER10',
      breakdown: {
        bulk_discount_cents: expected.bulk_discount_cents,
        code_discount_cents: expected.code_discount_cents,
        total_cents: expected.total_cents,
      },
    })
    expect(body.breakdown.bulk_discount_cents).toBeGreaterThan(0)
    expect(body.breakdown.code_discount_cents).toBeGreaterThan(0)
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: expected.total_cents,
        discount_applied: false,
        applied_coupon_code: 'SUMMER10',
      }),
    )
  })

  test('a fixed catalog code is floored at $225/song', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({
      data: [catalogRow({ code: 'INDIE150', kind: 'fixed', value: 15000 })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    // 1 song: fixed 15000 off list 32500 would land at 17500 — the D4 floor
    // clamps the charge to 22500.
    const req = createMockRequest(orderBody({ code: 'INDIE150' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 22500 }),
    )
    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      code_discount_cents: 10000,
      subtotal_cents: 22500,
      total_cents: 22500,
    })
  })

  test('an allow_below_floor code pierces the floor (D-floor-private)', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({
      data: [
        catalogRow({
          code: 'INDIE150',
          kind: 'fixed',
          value: 15000,
          is_public: false,
          allow_below_floor: true,
        }),
      ],
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    // The exempt sibling of the floored vector above: 32500 - 15000 charges
    // the full 17500, below the $225 floor.
    const req = createMockRequest(orderBody({ code: 'INDIE150' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 17500 }),
    )
    const body = await res.json()
    expect(body.breakdown).toMatchObject({
      code_discount_cents: 15000,
      subtotal_cents: 17500,
      total_cents: 17500,
    })
  })

  test.each([
    ['below the Stripe minimum', 32460, 40],
    ['fully comped to zero', 40000, 0],
  ])(
    'rejects a deep below-floor order priced %s with 400 and releases the hold',
    async (_label, value, total) => {
      const projectsChain = makeProjectsChain({})
      const rpc = lookupRpc({
        data: [
          catalogRow({
            code: 'DEEP',
            kind: 'fixed',
            value,
            is_public: false,
            allow_below_floor: true,
          }),
        ],
        error: null,
      })
      mockCreateClient.mockResolvedValue(
        createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
      )

      const expected = computeOrderPrice({
        songCount: 1,
        code: {
          kind: 'fixed',
          value,
          scope: 'private',
          allowBelowFloor: true,
        },
        buyer: { country: 'US' },
      })
      expect(expected.total_cents).toBe(total)

      const req = createMockRequest(orderBody({ code: 'DEEP' }))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('minimum chargeable amount')
      // The hold was acquired before pricing — the guard must return it.
      expect(serviceRpc).toHaveBeenCalledWith('restore_discount_code', {
        p_code: 'DEEP',
      })
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
      expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
    },
  )

  test('a lost reserve CAS rejects as exhausted before any side effect', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({
      data: [catalogRow({ single_use: true })],
      error: null,
    })
    serviceRpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === 'reserve_discount_code'
          ? { data: false, error: null }
          : { data: null, error: null },
      ),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('That code is no longer available.')
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
    // A lost CAS holds nothing — no restore may fire.
    expect(serviceRpc).not.toHaveBeenCalledWith(
      'restore_discount_code',
      expect.anything(),
    )
  })

  test('returns 500 when the reserve RPC itself fails', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    serviceRpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === 'reserve_discount_code'
          ? { data: null, error: { message: 'rpc down' } }
          : { data: null, error: null },
      ),
    )
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('a catalog code returns 500 before resolving when the service client is unavailable', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = vi.fn()
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
    // Resolve-before-reserve: the throw lands before any lookup or hold.
    expect(rpc).not.toHaveBeenCalled()
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('a WELCOME checkout uses the service client only for the insert', async () => {
    const projectsChain = makeProjectsChain({ pendingCount: 0 })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const req = createMockRequest(orderBody({ code: 'WELCOME' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    // The one-per-owner index on the insert is still WELCOME's hold — no
    // catalog reserve RPC fires; since 20260726 the insert itself is the
    // system write that rides the service client.
    expect(serviceRpc).not.toHaveBeenCalled()
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ applied_coupon_code: 'WELCOME' }),
    )
    expect(projectsChain.insert).not.toHaveBeenCalled()
  })

  test('cancels the intent and restores the catalog hold when insert fails', async () => {
    const projectsChain = makeProjectsChain({})
    serviceProjectsChain = makeProjectsChain({
      insertResult: { data: null, error: { message: 'db down' } },
    })
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)

    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_test_123')
    expect(serviceRpc).toHaveBeenCalledWith('restore_discount_code', {
      p_code: 'SUMMER10',
    })
  })

  test('restores the catalog hold when Stripe intent creation fails', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    mockPaymentIntentsCreate.mockRejectedValueOnce(new Error('stripe error'))
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(502)
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
    expect(serviceRpc).toHaveBeenCalledWith('restore_discount_code', {
      p_code: 'SUMMER10',
    })
  })

  test('a submitted code skips the first-mix reserve entirely', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    // One code per order (D4): the flag is never reserved alongside a code,
    // so there is nothing to restore on failure either.
    expect(rpc).not.toHaveBeenCalledWith(
      'reserve_first_mix_discount',
      expect.anything(),
    )
  })

  test('rejects an unknown code with 400 before any side effect', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [], error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'NOPE99' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe("That code isn't valid.")
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
  })

  test('rejects an expired code with 400 and its message', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({
      data: [catalogRow({ expires_at: '2026-01-01T00:00:00.000Z' })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('That code has expired.')
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('WELCOME charges the private welcome percent for a first-time buyer', async () => {
    // count 0 serves both the rate-limit query and the D5 paid-count query:
    // no pending checkouts, no prior paid project.
    const projectsChain = makeProjectsChain({ pendingCount: 0 })
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'WELCOME' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)

    // The welcome offer resolves in code (D11) — no catalog lookup, no flag
    // reserve; the charge matches the shared-constant private percent.
    expect(rpc).not.toHaveBeenCalled()
    const expected = computeOrderPrice({
      songCount: 1,
      code: { kind: 'percent', value: WELCOME_DISCOUNT_PCT, scope: 'private' },
      buyer: { country: 'US' },
    })
    expect(expected.total_cents).toBe(27625)
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expected.total_cents }),
    )
    const body = await res.json()
    expect(body).toMatchObject({
      amountCents: expected.total_cents,
      discountApplied: false,
      appliedCouponCode: 'WELCOME',
    })
    expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: expected.total_cents,
        discount_applied: false,
        applied_coupon_code: 'WELCOME',
      }),
    )
  })

  test('WELCOME returns 400 for a returning client', async () => {
    // count 1 passes the rate limit (1 < 3) and trips the D5 paid-count
    // (1 > 0): a prior paid project makes the caller returning.
    const projectsChain = makeProjectsChain({ pendingCount: 1 })
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'WELCOME' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('That code is only valid on your first order.')
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    expect(serviceProjectsChain.insert).not.toHaveBeenCalled()
  })

  test('maps the one-WELCOME-per-owner index violation to 400 and cancels the intent', async () => {
    // The losing side of the concurrent-D5 race (#25 residual): both
    // checkouts passed eligibility, the second insert dies on the 20260715
    // partial unique index — role-agnostic, so it fires for the service
    // insert too.
    const projectsChain = makeProjectsChain({ pendingCount: 0 })
    serviceProjectsChain = makeProjectsChain({
      insertResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "projects_one_welcome_per_owner"',
        },
      },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const req = createMockRequest(orderBody({ code: 'WELCOME' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe(
      'Your welcome offer is already attached to another order. Complete or cancel that checkout first.',
    )
    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_test_123')
  })

  test('a non-WELCOME duplicate-key insert failure stays a 500', async () => {
    const projectsChain = makeProjectsChain({ pendingCount: 0 })
    serviceProjectsChain = makeProjectsChain({
      insertResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "projects_pkey"',
        },
      },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const req = createMockRequest(orderBody({ code: 'WELCOME' }))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
  })

  test('dev bypass maps the WELCOME index violation to the same 400', async () => {
    const projectsChain = makeProjectsChain({ pendingCount: 0 })
    serviceProjectsChain = makeProjectsChain({
      insertResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "projects_one_welcome_per_owner"',
        },
      },
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      const req = createMockRequest(orderBody({ code: 'WELCOME' }))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('welcome offer is already attached')
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })

  test('returns 500 when the catalog lookup RPC fails', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: null, error: { message: 'rpc down' } })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )

    const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
    const res = await POST(req as NextRequest)
    // Infrastructure failure, not a rejection — the 400 mapping must not
    // swallow it.
    expect(res.status).toBe(500)
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
  })

  test('dev bypass persists the redeemed code and consumes it inline', async () => {
    const projectsChain = makeProjectsChain({})
    const rpc = lookupRpc({ data: [catalogRow()], error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: projectsChain },
        rpc,
      }),
    )
    const prev = process.env.PAYMENTS_DEV_BYPASS
    process.env.PAYMENTS_DEV_BYPASS = 'true'

    try {
      const req = createMockRequest(orderBody({ code: 'SUMMER10' }))
      const res = await POST(req as NextRequest)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toMatchObject({
        devBypass: true,
        amountCents: 0,
        appliedCouponCode: 'SUMMER10',
      })
      expect(serviceProjectsChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_cents: 0,
          discount_applied: false,
          applied_coupon_code: 'SUMMER10',
        }),
      )
      // Born-paid rows never reach the webhook: consumption finalizes
      // inline (#26/D6).
      expect(serviceRpc).toHaveBeenCalledWith('reserve_discount_code', {
        p_code: 'SUMMER10',
      })
      expect(serviceRpc).toHaveBeenCalledWith('consume_discount_code', {
        p_project_id: 'proj-new',
      })
    } finally {
      if (prev === undefined) {
        delete process.env.PAYMENTS_DEV_BYPASS
      } else {
        process.env.PAYMENTS_DEV_BYPASS = prev
      }
    }
  })
})
