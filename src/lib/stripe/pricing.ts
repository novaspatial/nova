import type { AddOn, Currency, PriceBreakdown } from '@/types/portal'

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

export type CodeScope = 'public' | 'private'

export type OrderCode =
  | { kind: 'percent'; value: number; scope: CodeScope } // value: whole percent (15 = 15%)
  | { kind: 'fixed'; value: number; scope: CodeScope } // value: amount in cents

export interface OrderInput {
  songCount: number
  addOns?: AddOn[]
  code?: OrderCode | null
  currency?: Currency
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
  const taxCents = 0 // tax owned by D2 / S8 (#24); not computed here.

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
    total_cents: subtotalCents + taxCents,
  }
}
