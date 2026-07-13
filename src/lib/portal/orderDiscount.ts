import type { SupabaseClient } from '@supabase/supabase-js'
import { WELCOME_DISCOUNT_PCT, type OrderCode } from '@/lib/stripe/pricing'

/**
 * Discount orchestration for a checkout order (#38).
 *
 * Owns the app side of the atomic first-mix RPCs (ADR-0004): reserving the
 * one-shot discount when an order starts, releasing the hold when the order
 * fails or is abandoned, and the single source for the OrderCode the
 * discount rides on — so the server charge and any client-side quote price
 * the same code. Atomicity stays in the `reserve_first_mix_discount` /
 * `restore_first_mix_discount` RPCs; only orchestration lives here.
 *
 * This module is the seam S4b (#25) and S5 (#26) grow into: #25 plugs
 * catalog-code resolution (lookup, expiry, D5 eligibility) into
 * `reserveOrderDiscount` without changing the route's shape, and #26 adds
 * its single-use hold to the same reservation — `release` returns it on
 * failure/abandon, and the webhook finalizes consumption on confirmed
 * payment per D6.
 */

// The one-shot first-mix discount rides the per-song pricing module as a
// private percent code: private codes do not stack with the bulk tier. At
// the 15% welcome rate (D11) the $225/song floor never binds — it stays as
// a guard for the arbitrary codes #25 will feed through this same path,
// which is also where the percentage moves to the welcome code system.
export const FIRST_MIX_CODE: OrderCode = {
  kind: 'percent',
  value: WELCOME_DISCOUNT_PCT,
  scope: 'private',
}

export interface DiscountReservation {
  /** Feed to `computeOrderPrice`; null when no discount was reserved. */
  code: OrderCode | null
  /** Persisted as `projects.discount_applied` and echoed to the client. */
  applied: boolean
  /**
   * Return the hold after a downstream failure (Stripe, insert). No-op when
   * nothing was reserved, idempotent otherwise (the RPC re-sets a flag), and
   * never throws — a failed restore is logged so it can't mask the original
   * error the caller is about to surface.
   */
  release: () => Promise<void>
}

/** The one copy of the return-the-reservation RPC call. */
async function restoreFirstMix(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('restore_first_mix_discount', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[orderDiscount] first-mix restore failed', error)
  }
}

/**
 * Atomically reserve the signed-in user's order discount (today: the
 * first-mix flag, flipped true -> false by the RPC).
 *
 * Contract: resolve every throwing dependency (Stripe client, service
 * client, ...) BEFORE calling this — a throw between reserve and release
 * burns the one-shot discount with nothing left to restore it. After this
 * call, every failure path must end in `reservation.release()`.
 *
 * Returns `reservation: null` plus the RPC error message when the reserve
 * call itself fails (the caller answers 500). "Nothing to reserve" is not
 * an error: that is a reservation with `applied: false`, a null code, and
 * a no-op release.
 */
export async function reserveOrderDiscount(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { reservation: DiscountReservation; error: null }
  | { reservation: null; error: string }
> {
  const { data, error } = await supabase.rpc('reserve_first_mix_discount', {
    p_user_id: userId,
  })
  if (error) {
    return { reservation: null, error: error.message }
  }
  const applied = data === true
  return {
    reservation: {
      code: applied ? FIRST_MIX_CODE : null,
      applied,
      release: applied
        ? () => restoreFirstMix(supabase, userId)
        : async () => {},
    },
    error: null,
  }
}

/**
 * Return the discount held by a project row that was never paid — the
 * cross-request counterpart of `release()` for abandon/delete flows, where
 * the in-memory reservation is long gone and the hold is reconstructed from
 * the row (`discount_applied` set, `paid_at` not). Never throws: a failed
 * restore is logged and must not block the delete that triggered it.
 */
export async function restoreUnpaidOrderDiscount(
  supabase: SupabaseClient,
  project: {
    owner_id: string
    discount_applied?: boolean | null
    paid_at?: string | null
  },
): Promise<void> {
  if (project.discount_applied && !project.paid_at) {
    await restoreFirstMix(supabase, project.owner_id)
  }
}
