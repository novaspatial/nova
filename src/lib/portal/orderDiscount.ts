import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WELCOME_DISCOUNT_PCT,
  WELCOME_PROMO_TOKEN,
  type OrderCode,
} from '@/lib/stripe/pricing'

/**
 * Discount orchestration for a checkout order (#38, #25).
 *
 * Owns the app side of the atomic first-mix RPCs (ADR-0004) and, since #25,
 * the resolution of a client-submitted discount code: the welcome offer
 * (code-enforced per D11, eligibility per D5) and catalog codes (#17's
 * `discount_codes`, read through the narrow `lookup_discount_code` RPC —
 * the table stays client-inert under RLS). The single source for the
 * OrderCode an order rides on, so the server charge and any client-side
 * quote price the same code.
 *
 * S5 (#26) grows into the same seam: the single-use/usage-limit hold is
 * acquired where `resolveSubmittedCode` succeeds inside
 * `reserveOrderDiscount`, returned through the same `release()`,
 * `restoreUnpaidOrderDiscount` learns the row-based restore keyed on
 * `applied_coupon_code`, and the webhook finalizes consumption on confirmed
 * payment per D6.
 */

// The one-shot first-mix discount rides the per-song pricing module as a
// private percent code: private codes do not stack with the bulk tier. At
// the 15% welcome rate (D11) the $225/song floor never binds — it stays as
// a guard for the arbitrary codes #25 feeds through this same path.
export const FIRST_MIX_CODE: OrderCode = {
  kind: 'percent',
  value: WELCOME_DISCOUNT_PCT,
  scope: 'private',
}

// One copy for admin creation and checkout redemption: normalized codes are
// uppercase alphanumerics (plus _ -), 3-40 chars. Mirrors the DB CHECK on
// discount_codes.code and projects.applied_coupon_code.
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

// D11: the welcome offer is code-enforced from here on — clients redeem this
// code at checkout and eligibility is D5 (no prior paid project). Derived
// from the marketing promo token, not a catalog row, so the charged percent
// can never drift from the advertised WELCOME_DISCOUNT_PCT (the #9
// rationale). A catalog row literally named WELCOME is shadowed by the
// resolver and never applies; the admin route refuses to create one.
export const WELCOME_COUPON_CODE = WELCOME_PROMO_TOKEN.toUpperCase()

export interface DiscountReservation {
  /** Feed to `computeOrderPrice`; null when no discount was reserved. */
  code: OrderCode | null
  /**
   * The normalized code the order was priced with ('WELCOME' or a catalog
   * code) — persisted as `projects.applied_coupon_code`. Null on the
   * no-code path, including the first-mix flag fallback.
   */
  couponCode: string | null
  /**
   * Strictly "the first-mix flag was reserved" — persisted as
   * `projects.discount_applied` and echoed to the client. Deliberately NOT
   * set for welcome/catalog codes: `restoreUnpaidOrderDiscount` and the
   * restore RPC's consumed-check key off the flag semantics.
   */
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
 * D5 eligibility: "returning client" = any prior paid Project (`paid_at`
 * set); delivery not required. Runs on the session client — the projects
 * SELECT policy lets owners read all their rows, and soft-deleted paid rows
 * still count (the row persists until hard-delete).
 */
export async function hasPriorPaidProject(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ prior: boolean; error: string | null }> {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .not('paid_at', 'is', null)
  if (error) {
    return { prior: false, error: error.message }
  }
  return { prior: (count ?? 0) > 0, error: null }
}

export type CodeRejectionReason =
  // Bad format, unknown, or deactivated — deliberately indistinct so the
  // validate endpoint is not an enumeration oracle for the catalog.
  | 'invalid'
  | 'expired'
  | 'new_clients_only'
  | 'returning_clients_only'

export const CODE_REJECTION_MESSAGES: Record<CodeRejectionReason, string> = {
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  new_clients_only: 'That code is only valid on your first order.',
  returning_clients_only: 'That code is for returning clients only.',
}

export type CodeResolution =
  | { ok: true; couponCode: string; code: OrderCode }
  | { ok: false; rejection: { reason: CodeRejectionReason; message: string } }
  // Lookup/eligibility query failure — infrastructure, not a rejection.
  | { ok: false; rejection: null; error: string }

function reject(reason: CodeRejectionReason): CodeResolution {
  return {
    ok: false,
    rejection: { reason, message: CODE_REJECTION_MESSAGES[reason] },
  }
}

/** The narrow row shape `lookup_discount_code` returns. */
type CatalogRow = {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  is_public: boolean
  single_use: boolean
  usage_limit: number | null
  new_clients_only: boolean
  returning_clients_only: boolean
  active: boolean
  expires_at: string | null
}

/**
 * Resolve a client-submitted discount code into the OrderCode the charge and
 * every quote surface price with. Shared by the checkout route (inside
 * `reserveOrderDiscount`) and the validate endpoint (preview only, no
 * reservation). Server-side re-validation is total: format, catalog lookup,
 * active, expiry, and D5 audience eligibility all happen here — a client
 * quote is never trusted.
 */
export async function resolveSubmittedCode(
  supabase: SupabaseClient,
  userId: string,
  submittedCode: string,
): Promise<CodeResolution> {
  const normalized = submittedCode.trim().toUpperCase()
  if (!CODE_PATTERN.test(normalized)) {
    return reject('invalid')
  }

  // The welcome offer (D11): resolved in code, never from the catalog, so
  // the charged percent and the advertised copy share WELCOME_DISCOUNT_PCT.
  // Same OrderCode shape as the first-mix flag path — private, so it does
  // not stack with the bulk tier (D4).
  if (normalized === WELCOME_COUPON_CODE) {
    const { prior, error } = await hasPriorPaidProject(supabase, userId)
    if (error) {
      return { ok: false, rejection: null, error }
    }
    if (prior) {
      return reject('new_clients_only')
    }
    return { ok: true, couponCode: WELCOME_COUPON_CODE, code: FIRST_MIX_CODE }
  }

  const { data, error } = await supabase.rpc('lookup_discount_code', {
    p_code: normalized,
  })
  if (error) {
    return { ok: false, rejection: null, error: error.message }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | CatalogRow
    | null
    | undefined
  if (!row) {
    return reject('invalid')
  }
  if (!row.active) {
    return reject('invalid')
  }
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    return reject('expired')
  }

  // Audience gates (D5). The eligibility query only runs when a flag is set —
  // unrestricted codes resolve without the extra roundtrip.
  if (row.new_clients_only || row.returning_clients_only) {
    const { prior, error: priorError } = await hasPriorPaidProject(
      supabase,
      userId,
    )
    if (priorError) {
      return { ok: false, rejection: null, error: priorError }
    }
    if (row.new_clients_only && prior) {
      return reject('new_clients_only')
    }
    if (row.returning_clients_only && !prior) {
      return reject('returning_clients_only')
    }
  }

  // #26 (D6) adds the atomic hold here: single_use / usage_limit codes
  // currently redeem WITHOUT consumption tracking — the code charges
  // correctly but nothing stops re-use. Do not distribute single-use or
  // usage-limited codes before #26 ships.
  return {
    ok: true,
    couponCode: row.code,
    code: {
      kind: row.kind,
      value: row.value,
      scope: row.is_public ? 'public' : 'private',
    },
  }
}

/**
 * Client-safe label for the code-discount line and badge: the welcome offer
 * (code-redeemed or the legacy first-mix flag) keeps its marketing name;
 * any other code is shown literally so the buyer can verify what applied.
 */
export function discountBadgeLabel(
  appliedCouponCode: string | null,
  discountApplied: boolean,
): string | null {
  if (appliedCouponCode === WELCOME_COUPON_CODE) return 'Welcome discount'
  if (appliedCouponCode) return `Discount · ${appliedCouponCode}`
  return discountApplied ? 'Welcome discount' : null
}

/**
 * Atomically reserve the signed-in user's order discount.
 *
 * With a `submittedCode`, all resolution happens here (welcome special
 * case, catalog lookup, expiry, D5 eligibility) and the first-mix reserve
 * is skipped entirely — one code per order (D4). A rejected code returns
 * the distinguishable `rejection` variant (the caller answers 400, versus
 * 500 for an infrastructure failure). In #25 a resolved code holds nothing
 * (release is a no-op); #26 acquires its single-use hold at this point and
 * returns it through the same `release()`.
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
  opts: { submittedCode?: string | null } = {},
): Promise<
  | { reservation: DiscountReservation; error: null }
  | { reservation: null; error: string }
  | { reservation: null; error: string; rejection: CodeRejectionReason }
> {
  if (opts.submittedCode) {
    const resolution = await resolveSubmittedCode(
      supabase,
      userId,
      opts.submittedCode,
    )
    if (!resolution.ok) {
      if (resolution.rejection) {
        return {
          reservation: null,
          error: resolution.rejection.message,
          rejection: resolution.rejection.reason,
        }
      }
      return { reservation: null, error: resolution.error }
    }
    return {
      reservation: {
        code: resolution.code,
        couponCode: resolution.couponCode,
        applied: false,
        release: async () => {},
      },
      error: null,
    }
  }

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
      couponCode: null,
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
 * Welcome/catalog-code rows hold nothing in #25 (`discount_applied` false);
 * #26 grows the catalog-hold restore here, keyed on `applied_coupon_code`.
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
