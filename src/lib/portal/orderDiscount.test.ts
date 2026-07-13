import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createChainMock,
  createSupabaseMock,
} from '@/test/helpers/supabaseMock'
import { WELCOME_DISCOUNT_PCT } from '@/lib/stripe/pricing'
import {
  FIRST_MIX_CODE,
  WELCOME_COUPON_CODE,
  CODE_REJECTION_MESSAGES,
  hasPriorPaidProject,
  resolveSubmittedCode,
  discountBadgeLabel,
  reserveOrderDiscount,
  restoreUnpaidOrderDiscount,
  type CodeRejectionReason,
} from './orderDiscount'

function makeSupabase(rpc: ReturnType<typeof vi.fn>) {
  return createSupabaseMock({ rpc }) as unknown as SupabaseClient
}

function makeClient({
  rpc = vi.fn().mockResolvedValue({ data: null, error: null }),
  projects,
}: {
  rpc?: ReturnType<typeof vi.fn>
  projects?: ReturnType<typeof createChainMock>
} = {}) {
  const client = createSupabaseMock({
    rpc,
    ...(projects ? { fromMocks: { projects } } : {}),
  })
  return { client, rpc, supabase: client as unknown as SupabaseClient }
}

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

function lookupRpc(row: Record<string, unknown> | null) {
  return vi.fn().mockResolvedValue({ data: row ? [row] : [], error: null })
}

function rejection(reason: CodeRejectionReason) {
  return {
    ok: false,
    rejection: { reason, message: CODE_REJECTION_MESSAGES[reason] },
  }
}

describe('FIRST_MIX_CODE', () => {
  test('is the private welcome-percent code — one source for quote and charge', () => {
    expect(FIRST_MIX_CODE).toEqual({
      kind: 'percent',
      value: WELCOME_DISCOUNT_PCT,
      scope: 'private',
    })
  })
})

describe('hasPriorPaidProject', () => {
  test('is true when a paid project exists — and asks with the D5 query shape', async () => {
    const projects = createChainMock({ count: 2, error: null })
    const { supabase } = makeClient({ projects })

    await expect(hasPriorPaidProject(supabase, 'user-1')).resolves.toEqual({
      prior: true,
      error: null,
    })
    expect(projects.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    })
    expect(projects.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    expect(projects.not).toHaveBeenCalledWith('paid_at', 'is', null)
  })

  test.each([
    ['zero', 0],
    ['null', null],
  ])('is false when the count is %s', async (_label, count) => {
    const { supabase } = makeClient({
      projects: createChainMock({ count, error: null }),
    })

    await expect(hasPriorPaidProject(supabase, 'user-1')).resolves.toEqual({
      prior: false,
      error: null,
    })
  })

  test('surfaces the query error message', async () => {
    const { supabase } = makeClient({
      projects: createChainMock({
        count: null,
        error: { message: 'rls denied' },
      }),
    })

    await expect(hasPriorPaidProject(supabase, 'user-1')).resolves.toEqual({
      prior: false,
      error: 'rls denied',
    })
  })
})

describe('resolveSubmittedCode', () => {
  test("normalizes ' summer10 ' to SUMMER10 before the catalog lookup", async () => {
    const rpc = lookupRpc(catalogRow())
    const { supabase } = makeClient({ rpc })

    const result = await resolveSubmittedCode(supabase, 'user-1', ' summer10 ')

    expect(rpc).toHaveBeenCalledWith('lookup_discount_code', {
      p_code: 'SUMMER10',
    })
    expect(result).toEqual({
      ok: true,
      couponCode: 'SUMMER10',
      code: { kind: 'percent', value: 10, scope: 'public' },
    })
  })

  test('rejects a malformed code as invalid without hitting the catalog', async () => {
    const rpc = vi.fn()
    const { supabase } = makeClient({ rpc })

    const result = await resolveSubmittedCode(supabase, 'user-1', 'no spaces!')

    expect(result).toEqual(rejection('invalid'))
    expect(rpc).not.toHaveBeenCalled()
  })

  test('an unknown and an inactive code reject indistinguishably as invalid', async () => {
    const unknownClient = makeClient({ rpc: lookupRpc(null) })
    const inactiveClient = makeClient({
      rpc: lookupRpc(catalogRow({ active: false })),
    })

    const unknown = await resolveSubmittedCode(
      unknownClient.supabase,
      'user-1',
      'GHOST10',
    )
    const inactive = await resolveSubmittedCode(
      inactiveClient.supabase,
      'user-1',
      'SUMMER10',
    )

    expect(unknown).toEqual(rejection('invalid'))
    // Anti-enumeration: a probe cannot tell deactivated from nonexistent.
    expect(inactive).toEqual(unknown)
  })

  test('rejects as expired at the exact expiry boundary', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(
        catalogRow({ expires_at: new Date(Date.now()).toISOString() }),
      ),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toEqual(rejection('expired'))
  })

  test('a future expiry still resolves', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(
        catalogRow({
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toMatchObject({ ok: true, couponCode: 'SUMMER10' })
  })

  test('a lookup failure is an infrastructure error, not a rejection', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db down' } })
    const { supabase } = makeClient({ rpc })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toEqual({ ok: false, rejection: null, error: 'db down' })
  })

  test.each([
    ['public', true],
    ['private', false],
  ])('maps is_public %s onto the %s scope', async (scope, is_public) => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ is_public })),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toMatchObject({ ok: true, code: { scope } })
  })

  test('a fixed-amount code maps kind and value through', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(
        catalogRow({ kind: 'fixed', value: 5000, is_public: false }),
      ),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toEqual({
      ok: true,
      couponCode: 'SUMMER10',
      code: { kind: 'fixed', value: 5000, scope: 'private' },
    })
  })

  test('a new-clients-only code rejects a returning client', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ new_clients_only: true })),
      projects: createChainMock({ count: 1, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toEqual(rejection('new_clients_only'))
  })

  test('a new-clients-only code passes a first-time buyer', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ new_clients_only: true })),
      projects: createChainMock({ count: 0, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toMatchObject({ ok: true, couponCode: 'SUMMER10' })
  })

  test('a returning-clients-only code rejects a first-time buyer', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ returning_clients_only: true })),
      projects: createChainMock({ count: 0, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toEqual(rejection('returning_clients_only'))
  })

  test('a returning-clients-only code passes a returning client', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ returning_clients_only: true })),
      projects: createChainMock({ count: 3, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toMatchObject({ ok: true, couponCode: 'SUMMER10' })
  })

  test('an audience-unrestricted code never runs the eligibility query', async () => {
    const { client, supabase } = makeClient({ rpc: lookupRpc(catalogRow()) })

    await resolveSubmittedCode(supabase, 'user-1', 'SUMMER10')

    expect(client.from).not.toHaveBeenCalledWith('projects')
  })

  test('WELCOME resolves in code for a first-time buyer — no catalog call', async () => {
    const rpc = vi.fn()
    const { supabase } = makeClient({
      rpc,
      projects: createChainMock({ count: 0, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'WELCOME'),
    ).resolves.toEqual({
      ok: true,
      couponCode: WELCOME_COUPON_CODE,
      code: { kind: 'percent', value: WELCOME_DISCOUNT_PCT, scope: 'private' },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  test("' welcome ' resolves case-insensitively to the WELCOME coupon", async () => {
    const { supabase } = makeClient({
      projects: createChainMock({ count: 0, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', ' welcome '),
    ).resolves.toMatchObject({ ok: true, couponCode: 'WELCOME' })
  })

  test('WELCOME rejects a returning client as new_clients_only', async () => {
    const rpc = vi.fn()
    const { supabase } = makeClient({
      rpc,
      projects: createChainMock({ count: 1, error: null }),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'WELCOME'),
    ).resolves.toEqual(rejection('new_clients_only'))
    expect(rpc).not.toHaveBeenCalled()
  })

  test('a single-use code still resolves before #26 lands consumption (the #25 interim)', async () => {
    const { supabase } = makeClient({
      rpc: lookupRpc(catalogRow({ single_use: true, usage_limit: 1 })),
    })

    await expect(
      resolveSubmittedCode(supabase, 'user-1', 'SUMMER10'),
    ).resolves.toMatchObject({ ok: true, couponCode: 'SUMMER10' })
  })
})

describe('discountBadgeLabel', () => {
  test.each<[string, string | null, boolean, string | null]>([
    ['the welcome code keeps its marketing name', 'WELCOME', false, 'Welcome discount'],
    ['a catalog code is shown literally', 'SUMMER10', false, 'Discount · SUMMER10'],
    ['the legacy first-mix flag reads as the welcome offer', null, true, 'Welcome discount'],
    ['no discount yields no badge', null, false, null],
  ])('%s', (_label, couponCode, applied, expected) => {
    expect(discountBadgeLabel(couponCode, applied)).toBe(expected)
  })
})

describe('reserveOrderDiscount', () => {
  test('reserves the first-mix discount and carries its code', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const { reservation, error } = await reserveOrderDiscount(
      makeSupabase(rpc),
      'user-1',
    )

    expect(error).toBeNull()
    expect(rpc).toHaveBeenCalledWith('reserve_first_mix_discount', {
      p_user_id: 'user-1',
    })
    expect(reservation).toMatchObject({
      applied: true,
      code: FIRST_MIX_CODE,
      couponCode: null,
    })
  })

  test('an ineligible user gets an empty reservation with a no-op release', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    const { reservation } = await reserveOrderDiscount(
      makeSupabase(rpc),
      'user-1',
    )

    expect(reservation).toMatchObject({
      applied: false,
      code: null,
      couponCode: null,
    })
    await reservation!.release()
    // Only the reserve call — no restore fires for a hold that never existed.
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('surfaces the RPC error message when the reserve call fails', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db down' } })
    const result = await reserveOrderDiscount(makeSupabase(rpc), 'user-1')

    expect(result).toEqual({ reservation: null, error: 'db down' })
  })

  test('release returns the reservation via the restore RPC', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    const { reservation } = await reserveOrderDiscount(
      makeSupabase(rpc),
      'user-1',
    )

    await reservation!.release()
    expect(rpc).toHaveBeenNthCalledWith(2, 'restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })

  describe('release failure', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    beforeEach(() => consoleError.mockClear())
    afterEach(() => consoleError.mockReset())

    test('logs instead of throwing, so it cannot mask the original error', async () => {
      const rpc = vi
        .fn()
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'restore failed' },
        })
      const { reservation } = await reserveOrderDiscount(
        makeSupabase(rpc),
        'user-1',
      )

      await expect(reservation!.release()).resolves.toBeUndefined()
      expect(consoleError).toHaveBeenCalled()
    })
  })

  describe('with a submitted code', () => {
    test('never calls the first-mix reserve RPC', async () => {
      const rpc = lookupRpc(catalogRow())
      const { supabase } = makeClient({ rpc })

      await reserveOrderDiscount(supabase, 'user-1', {
        submittedCode: 'SUMMER10',
      })

      expect(rpc).not.toHaveBeenCalledWith(
        'reserve_first_mix_discount',
        expect.anything(),
      )
    })

    test('a resolved code reserves with applied:false and a no-op release', async () => {
      const rpc = lookupRpc(catalogRow())
      const { supabase } = makeClient({ rpc })

      const { reservation, error } = await reserveOrderDiscount(
        supabase,
        'user-1',
        { submittedCode: 'SUMMER10' },
      )

      expect(error).toBeNull()
      expect(reservation).toMatchObject({
        applied: false,
        couponCode: 'SUMMER10',
        code: { kind: 'percent', value: 10, scope: 'public' },
      })

      await reservation!.release()
      // Only the lookup ran — a resolved code holds nothing in #25.
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(rpc).not.toHaveBeenCalledWith(
        'restore_first_mix_discount',
        expect.anything(),
      )
    })

    test('a rejected code returns the rejection variant for the 400 path', async () => {
      const { supabase } = makeClient({ rpc: lookupRpc(null) })

      const result = await reserveOrderDiscount(supabase, 'user-1', {
        submittedCode: 'GHOST10',
      })

      expect(result).toEqual({
        reservation: null,
        error: CODE_REJECTION_MESSAGES.invalid,
        rejection: 'invalid',
      })
    })

    test('a resolver infrastructure failure returns the 500 variant without a rejection', async () => {
      const rpc = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'db down' } })
      const { supabase } = makeClient({ rpc })

      const result = await reserveOrderDiscount(supabase, 'user-1', {
        submittedCode: 'SUMMER10',
      })

      expect(result).toEqual({ reservation: null, error: 'db down' })
      expect('rejection' in result).toBe(false)
    })
  })
})

describe('restoreUnpaidOrderDiscount', () => {
  test('restores when the row reserved the discount but was never paid', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    await restoreUnpaidOrderDiscount(makeSupabase(rpc), {
      owner_id: 'user-1',
      discount_applied: true,
      paid_at: null,
    })

    expect(rpc).toHaveBeenCalledWith('restore_first_mix_discount', {
      p_user_id: 'user-1',
    })
  })

  test.each([
    ['the project is paid', { discount_applied: true, paid_at: '2026-04-01T00:00:00.000Z' }],
    ['no discount was reserved', { discount_applied: false, paid_at: null }],
    ['the payment flags are absent', {}],
  ])('does not restore when %s', async (_label, flags) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    await restoreUnpaidOrderDiscount(makeSupabase(rpc), {
      owner_id: 'user-1',
      ...flags,
    })

    expect(rpc).not.toHaveBeenCalled()
  })
})
