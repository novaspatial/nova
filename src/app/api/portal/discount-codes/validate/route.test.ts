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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when not authenticated', async () => {
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null, rpc }))
    const req = createMockRequest({ code: 'WELCOME' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  test.each([
    ['the body is missing', undefined],
    ['the code is not a string', { code: 42 }],
    ['the code is empty', { code: '' }],
    ['the code is whitespace', { code: '   ' }],
  ])('returns 400 when %s', async (_label, body) => {
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))
    const req =
      body === undefined
        ? createMockRequest(undefined, { method: 'POST' })
        : createMockRequest(body)
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Enter a discount code')
    expect(rpc).not.toHaveBeenCalled()
  })

  test('returns the OrderCode for a valid public catalog code', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [catalogRow()], error: null })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

    // Submitted lowercase: the resolver normalizes before the exact lookup.
    const req = createMockRequest({ code: 'summer10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'SUMMER10',
      code: { kind: 'percent', value: 10, scope: 'public' },
    })
    expect(rpc).toHaveBeenCalledWith('lookup_discount_code', {
      p_code: 'SUMMER10',
    })
  })

  test('maps a non-public catalog row to a private-scope OrderCode', async () => {
    const rpc = vi.fn().mockResolvedValue({
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
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

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
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest({ code: 'welcome' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      couponCode: 'WELCOME',
      code: { kind: 'percent', value: 15, scope: 'private' },
    })
    // D11: never resolved from the catalog — no RPC of any kind fires.
    expect(rpc).not.toHaveBeenCalled()
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
    const rpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ fromMocks: { projects: projectsChain }, rpc }),
    )

    const req = createMockRequest({ code: 'WELCOME' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(
      'That code is only valid on your first order.',
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  test("rejects an unknown code with the generic \"isn't valid\" message", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

    const req = createMockRequest({ code: 'NOSUCHCODE' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("That code isn't valid.")
  })

  test('rejects a deactivated code exactly like an unknown one (anti-enumeration)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [catalogRow({ active: false })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    // The same message the unknown-code path answers with: the validate
    // endpoint must not be an oracle for which codes exist but are inactive.
    expect((await res.json()).error).toBe("That code isn't valid.")
  })

  test('rejects an expired code', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [catalogRow({ expires_at: '2026-01-01T00:00:00Z' })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That code has expired.')
  })

  test('rejects a fully-consumed code as no longer available (#26)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [catalogRow({ single_use: true, redeemed_count: 1 })],
      error: null,
    })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

    const req = createMockRequest({ code: 'SUMMER10' })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That code is no longer available.')
  })

  test('a below-floor code carries allowBelowFloor on the OrderCode (D-floor-private)', async () => {
    // The preview must price like the charge: the flag rides the OrderCode
    // the client feeds its own computeOrderPrice.
    const rpc = vi.fn().mockResolvedValue({
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
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

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
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'rpc down' } })
    mockCreateClient.mockResolvedValue(createSupabaseMock({ rpc }))

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
    const welcomeRpc = vi.fn()
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        fromMocks: { projects: welcomeProjects },
        rpc: welcomeRpc,
      }),
    )
    const welcomeRes = await POST(
      createMockRequest({ code: 'WELCOME' }) as NextRequest,
    )
    expect(welcomeRes.status).toBe(200)
    expect(welcomeRpc).not.toHaveBeenCalled()
    expect(welcomeProjects.insert).not.toHaveBeenCalled()
    expect(welcomeProjects.update).not.toHaveBeenCalled()

    // Catalog happy path: exactly one lookup RPC and no table access.
    const catalogProjects = createChainMock({ count: 0, error: null })
    const catalogRpc = vi
      .fn()
      .mockResolvedValue({ data: [catalogRow()], error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: catalogProjects },
      rpc: catalogRpc,
    })
    mockCreateClient.mockResolvedValue(supabase)
    const catalogRes = await POST(
      createMockRequest({ code: 'SUMMER10' }) as NextRequest,
    )
    expect(catalogRes.status).toBe(200)
    expect(catalogRpc).toHaveBeenCalledTimes(1)
    expect(catalogRpc).not.toHaveBeenCalledWith(
      'reserve_first_mix_discount',
      expect.anything(),
    )
    expect(supabase.from).not.toHaveBeenCalled()
    expect(catalogProjects.insert).not.toHaveBeenCalled()
  })
})
