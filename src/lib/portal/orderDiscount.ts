import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WELCOME_DISCOUNT_PCT,
  WELCOME_PROMO_TOKEN,
  type OrderCode,
} from '@/lib/stripe/pricing'

/**
 * Discount orchestration for a checkout order (#38, #25).
 *
 * Owns the app side of the atomic first-mix RPCs and, since #25,
 * the resolution of a client-submitted discount code: the welcome offer
 * (code-enforced per D11, eligibility per D5) and catalog codes (#17's
 * `discount_codes`, read through the narrow `lookup_discount_code` RPC —
 * the table stays client-inert under RLS). The single source for the
 * OrderCode an order rides on, so the server charge and any client-side
 * quote price the same code.
 *
 * Since 20260731 all six discount RPCs are EXECUTE-granted to service_role
 * only (the 20260715 catalog posture extended to the first-mix pair and the
 * lookup — anon could reach the uuid RPCs through the default grants, and
 * their identity guards pass a null uid). Every RPC in this module therefore
 * runs on the service client; only `hasPriorPaidProject` stays on the
 * session client, so RLS keeps applying to the one user-tied read.
 *
 * S5 (#26) grew into the same seam: `reserveOrderDiscount` acquires the
 * single-use/usage-limit hold (the `reserve_discount_code` CAS, service
 * client — grants are service_role-only per 20260715) where
 * `resolveSubmittedCode` succeeds and returns it through the same
 * `release()`; `restoreUnpaidOrderDiscount` returns the hold of a deleted
 * unpaid row, keyed on `applied_coupon_code`; and
 * `finalizeDiscountConsumption` consumes on confirmed payment per D6
 * (webhook — the durable finalizer, payment-status poll, and the
 * dev-bypass insert). WELCOME holds nothing here: its concurrency floor is
 * the one-WELCOME-per-owner partial unique index the checkout insert hits.
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
   * nothing was reserved (including WELCOME — the index is its hold), and
   * never throws — a failed restore is logged so it can't mask the original
   * error the caller is about to surface. Callers must not double-fire it:
   * the first-mix restore is naturally idempotent (re-sets a flag), but the
   * catalog restore decrements a counter.
   */
  release: () => Promise<void>
}

/**
 * The one copy of the return-the-first-mix-reservation RPC call. Service
 * client only (20260731 grants) — the identity guard that used to let the
 * session client call this is gone with the grant.
 */
async function restoreFirstMix(
  serviceSupabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await serviceSupabase.rpc('restore_first_mix_discount', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[orderDiscount] first-mix restore failed', error)
  }
}

/**
 * The one copy of the return-the-catalog-hold RPC call (#26). Service
 * client only — the RPC's EXECUTE is revoked from authenticated so a raw
 * PostgREST caller can't burn or refund holds (see 20260715).
 */
async function restoreDiscountCode(
  serviceSupabase: SupabaseClient,
  code: string,
): Promise<void> {
  const { error } = await serviceSupabase.rpc('restore_discount_code', {
    p_code: code,
  })
  if (error) {
    console.error('[orderDiscount] catalog-hold restore failed', error)
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
  // Capacity gone (#26): fully consumed/held at the resolve pre-check, or
  // the reserve CAS lost to a concurrent redemption/deactivation/expiry.
  // One message for every cause — honest, and no leakier than 'expired'.
  | 'exhausted'
  | 'new_clients_only'
  | 'returning_clients_only'
  // The one-WELCOME-per-owner index refused the insert (23505). Mapped by
  // the checkout route only — the resolver never emits it.
  | 'welcome_in_use'

export const CODE_REJECTION_MESSAGES: Record<CodeRejectionReason, string> = {
  invalid: "That code isn't valid.",
  expired: 'That code has expired.',
  exhausted: 'That code is no longer available.',
  new_clients_only: 'That code is only valid on your first order.',
  returning_clients_only: 'That code is for returning clients only.',
  welcome_in_use:
    'Your welcome offer is already attached to another order. Complete or cancel that checkout first.',
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
  reserved_count: number
  redeemed_count: number
  allow_below_floor: boolean
}

/**
 * Resolve a client-submitted discount code into the OrderCode the charge and
 * every quote surface price with. Shared by the checkout route (inside
 * `reserveOrderDiscount`) and the validate endpoint (preview only, no
 * reservation). Server-side re-validation is total: format, catalog lookup,
 * active, expiry, and D5 audience eligibility all happen here — a client
 * quote is never trusted. The two-client signature is deliberate: the
 * catalog lookup runs on the service client (20260731 grants), while the
 * D5 eligibility read stays on the caller's session client under RLS.
 */
export async function resolveSubmittedCode(
  supabase: SupabaseClient,
  serviceSupabase: SupabaseClient,
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

  const { data, error } = await serviceSupabase.rpc('lookup_discount_code', {
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

  // Capacity pre-check (#26): reject before the user reaches payment when
  // every unit is held or consumed. Advisory only — the atomic gate is the
  // reserve_discount_code CAS at checkout; a race past this check just
  // resolves as 'exhausted' there instead. Code-state checks come before
  // the user-state (audience) gates below.
  const effectiveLimit = row.single_use ? 1 : row.usage_limit
  if (
    effectiveLimit !== null &&
    row.reserved_count + row.redeemed_count >= effectiveLimit
  ) {
    return reject('exhausted')
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

  // The atomic hold itself is acquired by `reserveOrderDiscount` (checkout
  // only) — this resolver stays side-effect-free so the validate endpoint
  // can share it. allowBelowFloor spreads only when true so the OrderCode
  // stays minimal for the (dominant) non-exempt codes.
  return {
    ok: true,
    couponCode: row.code,
    code: {
      kind: row.kind,
      value: row.value,
      scope: row.is_public ? 'public' : 'private',
      ...(row.allow_below_floor ? { allowBelowFloor: true } : {}),
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
 * case, catalog lookup, expiry, capacity, D5 eligibility) and the first-mix
 * reserve is skipped entirely — one code per order (D4). A rejected code
 * returns the distinguishable `rejection` variant (the caller answers 400,
 * versus 500 for an infrastructure failure). A resolved CATALOG code then
 * acquires its hold via the `reserve_discount_code` CAS on
 * `opts.serviceSupabase` (#26/D6) and returns it through `release()`; a
 * CAS loss maps to the `exhausted` rejection. WELCOME acquires nothing —
 * the one-per-owner index on the insert is its hold.
 *
 * Contract: resolve every throwing dependency (Stripe client, service
 * client, ...) BEFORE calling this — a throw between reserve and release
 * burns the hold with nothing left to restore it. The service client is a
 * required positional since the 20260731 grants: every path needs it now
 * (catalog CAS and the first-mix reserve alike), so resolve it under the
 * same try/catch as Stripe. After this call, every failure path must end
 * in `reservation.release()`, exactly once.
 *
 * Returns `reservation: null` plus the RPC error message when the reserve
 * call itself fails (the caller answers 500). "Nothing to reserve" is not
 * an error: that is a reservation with `applied: false`, a null code, and
 * a no-op release.
 */
export async function reserveOrderDiscount(
  supabase: SupabaseClient,
  serviceSupabase: SupabaseClient,
  userId: string,
  opts: {
    submittedCode?: string | null
  } = {},
): Promise<
  | { reservation: DiscountReservation; error: null }
  | { reservation: null; error: string }
  | { reservation: null; error: string; rejection: CodeRejectionReason }
> {
  if (opts.submittedCode) {
    const resolution = await resolveSubmittedCode(
      supabase,
      serviceSupabase,
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

    if (resolution.couponCode === WELCOME_COUPON_CODE) {
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

    const couponCode = resolution.couponCode
    const { data, error } = await serviceSupabase.rpc('reserve_discount_code', {
      p_code: couponCode,
    })
    if (error) {
      return { reservation: null, error: error.message }
    }
    if (data !== true) {
      // Lost the CAS: the last unit went to a concurrent checkout, or the
      // code was deactivated/expired between resolve and reserve.
      return {
        reservation: null,
        error: CODE_REJECTION_MESSAGES.exhausted,
        rejection: 'exhausted',
      }
    }
    return {
      reservation: {
        code: resolution.code,
        couponCode,
        applied: false,
        release: () => restoreDiscountCode(serviceSupabase, couponCode),
      },
      error: null,
    }
  }

  const { data, error } = await serviceSupabase.rpc(
    'reserve_first_mix_discount',
    { p_user_id: userId },
  )
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
        ? () => restoreFirstMix(serviceSupabase, userId)
        : async () => {},
    },
    error: null,
  }
}

/**
 * Return the discount held by a project row that was never paid — the
 * cross-request counterpart of `release()` for abandon/delete flows, where
 * the in-memory reservation is long gone and the hold is reconstructed
 * from the row: the first-mix flag off `discount_applied`, the catalog
 * hold off `applied_coupon_code` (#26). Both restores run on the service
 * client (20260731 grants) — when it is null (key absent/misconfigured)
 * the seam logs and skips, never blocking the completed delete. WELCOME
 * rows hold nothing: deleting the row is itself the release (it frees the
 * one-per-owner index slot). Never throws: a failed restore is logged and
 * must not block the delete that triggered it.
 *
 * Exactly-once contract: call this with the DELETE-RETURNING row only (the
 * delete is the CAS), never with a pre-delete read — concurrent deletes
 * would otherwise double-decrement the catalog counter.
 */
export async function restoreUnpaidOrderDiscount(
  serviceSupabase: SupabaseClient | null,
  project: {
    owner_id: string
    discount_applied?: boolean | null
    paid_at?: string | null
    applied_coupon_code?: string | null
  },
): Promise<void> {
  if (project.paid_at) {
    return
  }
  if (!serviceSupabase) {
    if (project.discount_applied || project.applied_coupon_code) {
      console.error(
        '[orderDiscount] discount restore skipped: no service client',
        { code: project.applied_coupon_code ?? null },
      )
    }
    return
  }
  if (project.discount_applied) {
    await restoreFirstMix(serviceSupabase, project.owner_id)
  }
  const code = project.applied_coupon_code ?? null
  if (code && code !== WELCOME_COUPON_CODE) {
    await restoreDiscountCode(serviceSupabase, code)
  }
}

/**
 * Finalize a code's consumption once payment is confirmed (D6). Idempotent
 * per project — the consume RPC's ledger PK makes every caller after the
 * first a no-op — so the webhook, its Stripe replays, and the
 * payment-status poll can all call it safely. Codeless and WELCOME orders
 * skip the RPC roundtrip entirely: WELCOME's consumption is the paid row
 * itself (D5 + the one-per-owner index). Service client only (20260715
 * grants). Returns the error instead of throwing so each caller grades it:
 * the webhook answers 500 (Stripe's retry loop is the durable finalizer);
 * the poll and the dev-bypass insert log and continue.
 */
export async function finalizeDiscountConsumption(
  serviceSupabase: SupabaseClient,
  project: { id: string; applied_coupon_code: string | null },
): Promise<{ error: string | null }> {
  if (
    !project.applied_coupon_code ||
    project.applied_coupon_code === WELCOME_COUPON_CODE
  ) {
    return { error: null }
  }
  const { error } = await serviceSupabase.rpc('consume_discount_code', {
    p_project_id: project.id,
  })
  return { error: error ? error.message : null }
}
