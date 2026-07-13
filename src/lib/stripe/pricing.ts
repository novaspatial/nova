import type {
  AddOn,
  BuyerLocation,
  CAProvince,
  Currency,
  PriceBreakdown,
} from '@/types/portal'

// ---------------------------------------------------------------------------
// Per-song order pricing (P2 #5 + S4a #22 math). Pure: no DB, no UI, no I/O.
// The legacy flat computePrice ($299/$149) was removed when S1 (#16) rewired
// the checkout route to computeOrderPrice.
// Algorithm fixed by D3 (USD list, USD floor) and D4 (cap/floor/order-of-ops):
//
//   1. list total      = songCount × $325
//   2. bulk tier        3–4:15%  5–7:20%  8+:25%  (a private code suppresses it)
//   3. one code          percent OR fixed; one per order
//   4. 35% cap           limits the *stacked percentage* (bulk + percent code) only
//   5. floor             $225 USD per song × songCount — fixed codes obey only this
//   6. add-ons           added AFTER discounts, excluded from cap/floor base
//   7. GST/HST           on the discounted subtotal incl. add-ons when the
//                        buyer is Canadian (D2); non-CA buyers zero-rated
//   all math in integer cents, half-up rounding.
//
// Note: with a $225 USD per-song floor the floor binds at ~30.8%, so the 35%
// cap never actually binds at the current list price — it is a secondary guard.
// ---------------------------------------------------------------------------

export const LIST_PRICE_PER_SONG_CENTS = 32500 // $325 USD/song (#16)
export const FLOOR_PER_SONG_CENTS = 22500 // $225 USD/song (D3, D4-a/b)
export const MAX_DISCOUNT_PCT = 35 // caps stacked percentage discounts (D4-c)

export const ADD_ON_CENTS: Record<AddOn, number> = {
  extra_revision: 5000, // +$50 (#19)
  rush_48h: 14900, // +$149 (#19)
}

// D11 (2026-07-13): the welcome offer that replaced the 50% launch promo.
// Single source for every surface that names the percentage — marketing copy
// and the checkout route's private code alike. Code-based enforcement lands
// with S4b (#25).
export const WELCOME_DISCOUNT_PCT = 15
// Marketing-attribution token stashed in user_metadata at signup (was
// '50off'). Value-agnostic on purpose: a future D11 revision must not orphan
// already-recorded metadata.
export const WELCOME_PROMO_TOKEN = 'welcome'

export type CATaxKind = 'gst' | 'hst'

// D2 (2026-07-13): full HST in HST provinces, 5% GST everywhere else in
// Canada (no PST/QST), non-CA buyers zero-rated. NS dropped to 14% on
// 2025-04-01. Whole percents, applied to the discounted subtotal including
// add-ons (tax on the whole consideration), half-up rounding. Rates are
// "as of now" — a CRA change is a one-line edit here plus a test update.
export const CA_TAX_RATES: Record<CAProvince, { pct: number; kind: CATaxKind }> = {
  AB: { pct: 5, kind: 'gst' },
  BC: { pct: 5, kind: 'gst' },
  MB: { pct: 5, kind: 'gst' },
  NB: { pct: 15, kind: 'hst' },
  NL: { pct: 15, kind: 'hst' },
  NS: { pct: 14, kind: 'hst' },
  NT: { pct: 5, kind: 'gst' },
  NU: { pct: 5, kind: 'gst' },
  ON: { pct: 13, kind: 'hst' },
  PE: { pct: 15, kind: 'hst' },
  QC: { pct: 5, kind: 'gst' }, // GST only — no QST per D2
  SK: { pct: 5, kind: 'gst' },
  YT: { pct: 5, kind: 'gst' },
}

export type CodeScope = 'public' | 'private'

export type OrderCode =
  | { kind: 'percent'; value: number; scope: CodeScope } // value: whole percent (15 = 15%)
  | { kind: 'fixed'; value: number; scope: CodeScope } // value: amount in cents

export interface OrderInput {
  songCount: number
  addOns?: AddOn[]
  code?: OrderCode | null
  currency?: Currency
  // Billing location for GST/HST (#31). Absent/null → tax 0, so non-checkout
  // callers (e.g. the homepage calculator, #30) opt in explicitly.
  buyer?: BuyerLocation | null
}

// Album/EP bulk auto-discount by song count (#18).
export function bulkDiscountPct(songCount: number): number {
  if (songCount >= 8) return 25
  if (songCount >= 5) return 20
  if (songCount >= 3) return 15
  return 0
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

export function computeOrderPrice(input: OrderInput): PriceBreakdown {
  const songCount = Math.max(0, Math.trunc(input.songCount))
  const currency: Currency = input.currency ?? 'usd'
  const code = input.code ?? null
  // De-duplicate add-ons: each add-on is charged at most once per order.
  const addOns = [...new Set(input.addOns ?? [])]

  const listTotalCents = songCount * LIST_PRICE_PER_SONG_CENTS

  // Private codes do NOT stack with bulk (#22): a private code suppresses the tier.
  const bulkPct = code?.scope === 'private' ? 0 : bulkDiscountPct(songCount)
  const bulkDiscountCents = roundHalfUp((listTotalCents * bulkPct) / 100)

  // Intended code discount, before the per-song floor clamps the order.
  let intendedCodeDiscountCents = 0
  if (code) {
    if (code.kind === 'percent') {
      // Clamp to a valid 0–100 percent first: a negative code must never
      // inflate the price above list. The 35% cap then limits the stacked
      // percentage (bulk + percent code).
      const pct = Math.min(100, Math.max(0, code.value))
      const cappedPct = Math.min(bulkPct + pct, MAX_DISCOUNT_PCT)
      const stackedDiscountCents = roundHalfUp((listTotalCents * cappedPct) / 100)
      intendedCodeDiscountCents = stackedDiscountCents - bulkDiscountCents
    } else {
      // Fixed codes are bounded only by the floor below — not the 35% cap (D4-c).
      intendedCodeDiscountCents = Math.max(0, Math.trunc(code.value))
    }
  }

  // Per-song floor in the USD charge currency (D4-a/b). Clamp the mix price so
  // each song never sells below the floor, then attribute the realized discount
  // bulk-first so the breakdown lines sum to the mix price.
  const floorTotalCents = songCount * FLOOR_PER_SONG_CENTS
  const intendedDiscountCents = bulkDiscountCents + intendedCodeDiscountCents
  const mixPriceCents = Math.max(listTotalCents - intendedDiscountCents, floorTotalCents)
  const effectiveDiscountCents = listTotalCents - mixPriceCents

  const effectiveBulkCents = Math.min(bulkDiscountCents, effectiveDiscountCents)
  const effectiveCodeCents = effectiveDiscountCents - effectiveBulkCents

  // Add-ons sit on top of the discounted, floored mix price (D4-d).
  const addOnsCents = addOns.reduce((sum, addOn) => sum + (ADD_ON_CENTS[addOn] ?? 0), 0)

  const subtotalCents = mixPriceCents + addOnsCents

  // GST/HST on the whole consideration: the discounted, floored mix price
  // plus add-ons (D2). Defensive: a CA buyer with no valid province still
  // owes at least 5% GST — a Canadian sale is never zero-rated (the checkout
  // route validates the province, so this fallback is unreachable there).
  let taxCents = 0
  let taxRatePct = 0
  let taxLabel: string | null = null
  if (input.buyer?.country === 'CA') {
    const rate =
      (input.buyer.province && CA_TAX_RATES[input.buyer.province]) ||
      ({ pct: 5, kind: 'gst' } as const)
    taxRatePct = rate.pct
    taxLabel = `${rate.kind.toUpperCase()} (${rate.pct}%)`
    taxCents = roundHalfUp((subtotalCents * rate.pct) / 100)
  }

  return {
    currency,
    song_count: songCount,
    list_unit_cents: LIST_PRICE_PER_SONG_CENTS,
    list_total_cents: listTotalCents,
    bulk_discount_cents: effectiveBulkCents,
    code_discount_cents: effectiveCodeCents,
    add_ons_cents: addOnsCents,
    subtotal_cents: subtotalCents,
    tax_cents: taxCents,
    tax_rate_pct: taxRatePct,
    tax_label: taxLabel,
    total_cents: subtotalCents + taxCents,
  }
}
