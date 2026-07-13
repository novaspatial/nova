import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseMock } from '@/test/helpers/supabaseMock'
import { WELCOME_DISCOUNT_PCT } from '@/lib/stripe/pricing'
import {
  FIRST_MIX_CODE,
  reserveOrderDiscount,
  restoreUnpaidOrderDiscount,
} from './orderDiscount'

function makeSupabase(rpc: ReturnType<typeof vi.fn>) {
  return createSupabaseMock({ rpc }) as unknown as SupabaseClient
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
    expect(reservation).toMatchObject({ applied: true, code: FIRST_MIX_CODE })
  })

  test('an ineligible user gets an empty reservation with a no-op release', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    const { reservation } = await reserveOrderDiscount(
      makeSupabase(rpc),
      'user-1',
    )

    expect(reservation).toMatchObject({ applied: false, code: null })
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
