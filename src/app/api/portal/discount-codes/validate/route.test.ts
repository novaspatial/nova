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

// The catalog lookup runs on the service client (20260731 grants); the
// session client keeps only the D5 eligibility read.
const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { POST } from './route'

/** The row shape the `lookup_discount_code` RPC returns. */
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
    reserved_count: 0,
    redeemed_count: 0,
    allow_below_floor: false,
    ...overrides,
  }
}

describe('POST /api/portal/discount-codes/validate', () => {
  let serviceRpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    serviceRpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockCreateServiceClient.mockImplementation(() =>
      createSupabaseMock({ rpc: serviceRpc }),
    )
  })

  function setLookup(result: {
    data: unknown
    error: { message: string } | null
  }) {
    serviceRpc.mockResolvedValue(result)
  }

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))
    const req = createMockRequest({ code: 'WELCOME' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  test.each([
    ['the body is missing', undefined],
    ['the code is not a string', { code: 42 }],
    ['the code is empty', { code: '' }],
    ['the code is whitespace', { code: '   ' }],
  ])('returns 400 when %s', async (_label, body) => {
    mockCreateClient.mockResolvedValue(createSupabaseMock())
    const req =
      body === undefined
        ? createMockRequest(undefined, { method: 'POST' })
        : createMockRequest(body)
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Enter a discount code')
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  test('returns the OrderCode for a valid public catalog code', async () => {
    setLookup({ data: [catalogRow()], error: null })
    const sessionRpc = vi.fn()
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc: sessionRpc }))

    // Submitted lowercase: the resolver normalizes before the exact lookup.
    const req = createMockRequest({ code: 'summer10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'SUMMER10',
      code: { kind: 'percent', value: 10, scope: 'public' },
    })
    expect(serviceRpc).toHaveBeenCalledWith('lookup_discount_code', {
      p_code: 'SUMMER10',
    })
    // The session client never carries an RPC anymore (20260731 grants).
    expect(sessionRpc).not.toHaveBeenCalled()
  })

  test('maps a non-public catalog row to a private-scope OrderCode', async () => {
    setLookup({
      data: [
        catalogRow({
          code: 'VIP50',
          kind: 'fixed',
          value: 5000,
          is_public: false,
        }),
      ],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'VIP50' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'VIP50',
      code: { kind: 'fixed', value: 5000, scope: 'private' },
    })
  })

  test('resolves WELCOME in code for a first-time buyer, without a catalog lookup', async () => {
    const projectsChain = createChainMock({ count: 0, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const req = createMockRequest({ code: 'welcome' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'WELCOME',
      code: { kind: 'percent', value: 15, scope: 'private' },
    })
    // D11: never resolved from the catalog — no RPC of any kind fires.
    expect(serviceRpc).not.toHaveBeenCalled()
    // D5 eligibility rides the prior-paid-project count query.
    expect(projectsChain.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(projectsChain.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(projectsChain.not).toHaveBeenCalledWith('paid_at', 'is', null)
  })

  test('rejects WELCOME for a returning client', async () => {
    const projectsChain = createChainMock({ count: 1, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain } }),
    )

    const req = createMockRequest({ code: 'WELCOME' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'That code is only valid on your first order.',
    )
    expect(serviceRpc).not.toHaveBeenCalled()
  })

  test("rejects an unknown code with the generic \"isn't valid\" message", async () => {
    setLookup({ data: [], error: null })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'NOSUCHCODE' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("That code isn't valid.")
  })

  test('rejects a deactivated code exactly like an unknown one (anti-enumeration)', async () => {
    setLookup({ data: [catalogRow({ active: false })], error: null })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    // The same message the unknown-code path answers with: the validate
    // endpoint must not be an oracle for which codes exist but are inactive.
    expect((await res.json()).error).toBe("That code isn't valid.")
  })

  test('rejects an expired code', async () => {
    setLookup({
      data: [catalogRow({ expires_at: '2026-01-01T00:00:00Z' })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That code has expired.')
  })

  test('rejects a fully-consumed code as no longer available (#26)', async () => {
    setLookup({
      data: [catalogRow({ single_use: true, redeemed_count: 1 })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That code is no longer available.')
  })

  test('a below-floor code carries allowBelowFloor on the OrderCode (D-floor-private)', async () => {
    // The preview must price like the charge: the flag rides the OrderCode
    // the client feeds its own computeOrderPrice.
    setLookup({
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
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'INDIE150' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'INDIE150',
      code: {
        kind: 'fixed',
        value: 15000,
        scope: 'private',
        allowBelowFloor: true,
      },
    })
  })

  test('returns 503 when the lookup RPC fails', async () => {
    setLookup({ data: null, error: { message: 'rpc down' } })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe(
      'Unable to validate the code right now. Please try again.',
    )
  })

  test('returns 503 when the service client is unavailable', async () => {
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock())

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe(
      'Unable to validate the code right now. Please try again.',
    )
  })

  test('preview never reserves the first-mix flag and never writes a row', async () => {
    // Welcome happy path: the eligibility SELECT is the only table access —
    // no RPC at all, so reserve_first_mix_discount cannot have fired.
    const welcomeProjects = createChainMock({ count: 0, error: null })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: welcomeProjects } }),
    )
    const welcomeRes = await POST(
      createMockRequest({ code: 'WELCOME' }) as NextRequest,
    )
    expect(welcomeRes.status).toBe(200)
    expect(serviceRpc).not.toHaveBeenCalled()
    expect(welcomeProjects.insert).not.toHaveBeenCalled()
    expect(welcomeProjects.update).not.toHaveBeenCalled()

    // Catalog happy path: exactly one lookup RPC and no table access.
    setLookup({ data: [catalogRow()], error: null })
    const catalogProjects = createChainMock({ count: 0, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: catalogProjects },
    })
    mockCreateClient.mockResolvedValue(supabase)
    const catalogRes = await POST(
      createMockRequest({ code: 'SUMMER10' }) as NextRequest,
    )
    expect(catalogRes.status).toBe(200)
    expect(serviceRpc).toHaveBeenCalledTimes(1)
    expect(serviceRpc).not.toHaveBeenCalledWith(
      'reserve_first_mix_discount',
      expect.anything(),
    )
    expect(supabase.from).not.toHaveBeenCalled()
    expect(catalogProjects.insert).not.toHaveBeenCalled()
  })
})
