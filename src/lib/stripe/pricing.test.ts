import { describe, test, expect } from 'vitest'
import type { AddOn, Currency, PriceBreakdown } from '@/types/portal'
import {
  computeOrderPrice,
  bulkDiscountPct,
  LIST_PRICE_PER_SONG_CENTS,
  FLOOR_PER_SONG_CENTS,
  type OrderCode,
} from './pricing'

const percent = (value: number, scope: 'public' | 'private'): OrderCode => ({
  kind: 'percent',
  value,
  scope,
})

const fixed = (value: number, scope: 'public' | 'private'): OrderCode => ({
  kind: 'fixed',
  value,
  scope,
})

function breakdown(row: {
  songs: number
  list_total: number
  bulk: number
  code: number
  add_ons: number
  subtotal: number
  currency?: Currency
}): PriceBreakdown {
  return {
    currency: row.currency ?? 'usd',
    song_count: row.songs,
    list_unit_cents: 32500,
    list_total_cents: row.list_total,
    bulk_discount_cents: row.bulk,
    code_discount_cents: row.code,
    add_ons_cents: row.add_ons,
    subtotal_cents: row.subtotal,
    tax_cents: 0,
    total_cents: row.subtotal,
  }
}

describe('bulkDiscountPct', () => {
  test.each([
    [0, 0],
    [2, 0],
    [3, 15],
    [4, 15],
    [5, 20],
    [7, 20],
    [8, 25],
    [100, 25],
  ] as const)('%i songs → %i%%', (songCount, pct) => {
    expect(bulkDiscountPct(songCount)).toBe(pct)
  })
})

describe('computeOrderPrice', () => {
  describe('bulk tiers (no code, no add-ons)', () => {
    test.each([
      { songs: 0, list_total: 0, bulk: 0, code: 0, add_ons: 0, subtotal: 0 },
      { songs: 1, list_total: 32500, bulk: 0, code: 0, add_ons: 0, subtotal: 32500 },
      { songs: 2, list_total: 65000, bulk: 0, code: 0, add_ons: 0, subtotal: 65000 },
      { songs: 3, list_total: 97500, bulk: 14625, code: 0, add_ons: 0, subtotal: 82875 },
      { songs: 4, list_total: 130000, bulk: 19500, code: 0, add_ons: 0, subtotal: 110500 },
      { songs: 5, list_total: 162500, bulk: 32500, code: 0, add_ons: 0, subtotal: 130000 },
      { songs: 7, list_total: 227500, bulk: 45500, code: 0, add_ons: 0, subtotal: 182000 },
      { songs: 8, list_total: 260000, bulk: 65000, code: 0, add_ons: 0, subtotal: 195000 },
    ])('$songs songs → subtotal $subtotal', (row) => {
      expect(computeOrderPrice({ songCount: row.songs })).toEqual(breakdown(row))
    })
  })

  describe('percent public code stacks on bulk', () => {
    test.each([
      {
        name: '3 songs + 10% public',
        songs: 3,
        orderCode: percent(10, 'public'),
        list_total: 97500,
        bulk: 14625,
        code: 9750,
        add_ons: 0,
        subtotal: 73125,
      },
      {
        name: '1 song + 25% public',
        songs: 1,
        orderCode: percent(25, 'public'),
        list_total: 32500,
        bulk: 0,
        code: 8125,
        add_ons: 0,
        subtotal: 24375,
      },
      {
        name: '3 songs + 20% public (floor binds)',
        songs: 3,
        orderCode: percent(20, 'public'),
        list_total: 97500,
        bulk: 14625,
        code: 15375,
        add_ons: 0,
        subtotal: 67500,
      },
    ])('$name', (row) => {
      expect(computeOrderPrice({ songCount: row.songs, code: row.orderCode })).toEqual(
        breakdown(row)
      )
    })
  })

  describe('35% cap binds on the stacked percentage', () => {
    test.each([
      {
        name: '8 songs + 15% public (25 + 15 → capped 35)',
        songs: 8,
        orderCode: percent(15, 'public'),
        list_total: 260000,
        bulk: 65000,
        code: 15000,
        add_ons: 0,
        subtotal: 180000,
      },
      {
        name: '5 songs + 20% public (20 + 20 → capped 35)',
        songs: 5,
        orderCode: percent(20, 'public'),
        list_total: 162500,
        bulk: 32500,
        code: 17500,
        add_ons: 0,
        subtotal: 112500,
      },
    ])('$name', (row) => {
      expect(computeOrderPrice({ songCount: row.songs, code: row.orderCode })).toEqual(
        breakdown(row)
      )
    })
  })

  describe('per-song floor binds via percent code', () => {
    test('1 song + 30% public stays above the $225 floor', () => {
      expect(computeOrderPrice({ songCount: 1, code: percent(30, 'public') })).toEqual(
        breakdown({
          songs: 1,
          list_total: 32500,
          bulk: 0,
          code: 9750,
          add_ons: 0,
          subtotal: 22750,
        })
      )
    })
  })

  describe('fixed codes are floor-bounded only, never 35%-capped', () => {
    test.each([
      {
        name: '2 songs + $50 fixed',
        songs: 2,
        orderCode: fixed(5000, 'public'),
        list_total: 65000,
        bulk: 0,
        code: 5000,
        add_ons: 0,
        subtotal: 60000,
      },
      {
        name: '1 song + $200 fixed (floor binds)',
        songs: 1,
        orderCode: fixed(20000, 'public'),
        list_total: 32500,
        bulk: 0,
        code: 10000,
        add_ons: 0,
        subtotal: 22500,
      },
      {
        name: '1 song + $500 fixed (floor binds)',
        songs: 1,
        orderCode: fixed(50000, 'public'),
        list_total: 32500,
        bulk: 0,
        code: 10000,
        add_ons: 0,
        subtotal: 22500,
      },
    ])('$name', (row) => {
      expect(computeOrderPrice({ songCount: row.songs, code: row.orderCode })).toEqual(
        breakdown(row)
      )
    })
  })

  describe('private codes suppress the bulk tier', () => {
    test.each([
      {
        name: '8 songs + 10% private (no bulk)',
        songs: 8,
        orderCode: percent(10, 'private'),
        list_total: 260000,
        bulk: 0,
        code: 26000,
        add_ons: 0,
        subtotal: 234000,
      },
      {
        name: '8 songs + $300 fixed private (no bulk)',
        songs: 8,
        orderCode: fixed(30000, 'private'),
        list_total: 260000,
        bulk: 0,
        code: 30000,
        add_ons: 0,
        subtotal: 230000,
      },
      {
        name: '5 songs + 30% private (no bulk)',
        songs: 5,
        orderCode: percent(30, 'private'),
        list_total: 162500,
        bulk: 0,
        code: 48750,
        add_ons: 0,
        subtotal: 113750,
      },
    ])('$name', (row) => {
      expect(computeOrderPrice({ songCount: row.songs, code: row.orderCode })).toEqual(
        breakdown(row)
      )
    })
  })

  describe('add-ons apply after discounts and are de-duplicated', () => {
    test.each([
      {
        name: '2 songs + both add-ons',
        songs: 2,
        orderCode: null,
        addOns: ['extra_revision', 'rush_48h'] as AddOn[],
        list_total: 65000,
        bulk: 0,
        code: 0,
        add_ons: 19900,
        subtotal: 84900,
      },
      {
        name: '1 song + rush',
        songs: 1,
        orderCode: null,
        addOns: ['rush_48h'] as AddOn[],
        list_total: 32500,
        bulk: 0,
        code: 0,
        add_ons: 14900,
        subtotal: 47400,
      },
      {
        name: '1 song + 30% public + both add-ons (add-ons exempt from floor)',
        songs: 1,
        orderCode: percent(30, 'public'),
        addOns: ['extra_revision', 'rush_48h'] as AddOn[],
        list_total: 32500,
        bulk: 0,
        code: 9750,
        add_ons: 19900,
        subtotal: 42650,
      },
      {
        name: '8 songs + extra revision',
        songs: 8,
        orderCode: null,
        addOns: ['extra_revision'] as AddOn[],
        list_total: 260000,
        bulk: 65000,
        code: 0,
        add_ons: 5000,
        subtotal: 200000,
      },
      {
        name: '3 songs + duplicate extra revision charged once',
        songs: 3,
        orderCode: null,
        addOns: ['extra_revision', 'extra_revision'] as AddOn[],
        list_total: 97500,
        bulk: 14625,
        code: 0,
        add_ons: 5000,
        subtotal: 87875,
      },
    ])('$name', (row) => {
      expect(
        computeOrderPrice({ songCount: row.songs, code: row.orderCode, addOns: row.addOns })
      ).toEqual(breakdown(row))
    })
  })

  describe('defensive edges', () => {
    test('fractional song count truncates down', () => {
      const result = computeOrderPrice({ songCount: 3.9 })
      expect(result).toEqual(
        breakdown({
          songs: 3,
          list_total: 97500,
          bulk: 14625,
          code: 0,
          add_ons: 0,
          subtotal: 82875,
        })
      )
      expect(result.song_count).toBe(3)
    })

    test('negative song count clamps to zero', () => {
      const result = computeOrderPrice({ songCount: -4 })
      expect(result).toEqual(
        breakdown({ songs: 0, list_total: 0, bulk: 0, code: 0, add_ons: 0, subtotal: 0 })
      )
      expect(result.song_count).toBe(0)
    })

    test('percent code above 100 clamps to 100, then cap and floor apply', () => {
      expect(computeOrderPrice({ songCount: 1, code: percent(150, 'public') })).toEqual(
        breakdown({
          songs: 1,
          list_total: 32500,
          bulk: 0,
          code: 10000,
          add_ons: 0,
          subtotal: 22500,
        })
      )
    })

    test('negative percent code never inflates the price above list', () => {
      expect(computeOrderPrice({ songCount: 1, code: percent(-10, 'public') })).toEqual(
        breakdown({
          songs: 1,
          list_total: 32500,
          bulk: 0,
          code: 0,
          add_ons: 0,
          subtotal: 32500,
        })
      )
    })

    test('negative fixed code is guarded to zero', () => {
      expect(computeOrderPrice({ songCount: 1, code: fixed(-5000, 'public') })).toEqual(
        breakdown({
          songs: 1,
          list_total: 32500,
          bulk: 0,
          code: 0,
          add_ons: 0,
          subtotal: 32500,
        })
      )
    })

    test('cad currency passes through with cents unchanged', () => {
      const result = computeOrderPrice({ songCount: 1, currency: 'cad' })
      expect(result).toEqual(
        breakdown({
          songs: 1,
          list_total: 32500,
          bulk: 0,
          code: 0,
          add_ons: 0,
          subtotal: 32500,
          currency: 'cad',
        })
      )
      expect(result.currency).toBe('cad')
    })

    test('currency defaults to usd', () => {
      expect(computeOrderPrice({ songCount: 1 }).currency).toBe('usd')
    })
  })

  describe('invariants across the input grid', () => {
    const songCounts = [0, 1, 2, 3, 4, 5, 7, 8, 12]
    const codes: (OrderCode | null)[] = [null]
    for (const scope of ['public', 'private'] as const) {
      for (const value of [0, 10, 20, 35]) codes.push(percent(value, scope))
      for (const value of [5000, 30000, 50000]) codes.push(fixed(value, scope))
    }
    const addOnSets: AddOn[][] = [[], ['extra_revision'], ['extra_revision', 'rush_48h']]

    test('every grid point satisfies the pricing invariants', () => {
      for (const songCount of songCounts) {
        for (const code of codes) {
          for (const addOns of addOnSets) {
            const r = computeOrderPrice({ songCount, code, addOns })

            // Lines sum exactly to the subtotal.
            expect(
              r.list_total_cents - r.bulk_discount_cents - r.code_discount_cents + r.add_ons_cents
            ).toBe(r.subtotal_cents)

            // The mix price never sells below the per-song floor.
            expect(r.subtotal_cents - r.add_ons_cents).toBeGreaterThanOrEqual(
              r.song_count * FLOOR_PER_SONG_CENTS
            )

            // Discounts are non-negative and never exceed the list total.
            const discount = r.bulk_discount_cents + r.code_discount_cents
            expect(discount).toBeGreaterThanOrEqual(0)
            expect(discount).toBeLessThanOrEqual(r.list_total_cents)

            // Tax is not computed here (owned by D2 / S8).
            expect(r.total_cents).toBe(r.subtotal_cents + r.tax_cents)
            expect(r.tax_cents).toBe(0)

            // All money fields are integer cents.
            for (const value of [
              r.list_unit_cents,
              r.list_total_cents,
              r.bulk_discount_cents,
              r.code_discount_cents,
              r.add_ons_cents,
              r.subtotal_cents,
              r.tax_cents,
              r.total_cents,
            ]) {
              expect(Number.isInteger(value)).toBe(true)
            }

            // List math is exact.
            expect(r.list_unit_cents).toBe(LIST_PRICE_PER_SONG_CENTS)
            expect(r.list_total_cents).toBe(r.song_count * LIST_PRICE_PER_SONG_CENTS)
          }
        }
      }
    })
  })
})
