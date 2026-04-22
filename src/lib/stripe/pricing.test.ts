import { describe, test, expect } from 'vitest'
import {
  computePrice,
  FULL_PRICE_CENTS,
  FIRST_MIX_PRICE_CENTS,
  CURRENCY,
} from './pricing'

describe('computePrice', () => {
  test('returns the full price in USD when no discount applies', () => {
    expect(computePrice(false)).toEqual({
      amountCents: FULL_PRICE_CENTS,
      currency: 'usd',
    })
    expect(FULL_PRICE_CENTS).toBe(29900)
  })

  test('returns the first-mix price in USD when discount applies', () => {
    expect(computePrice(true)).toEqual({
      amountCents: FIRST_MIX_PRICE_CENTS,
      currency: 'usd',
    })
    expect(FIRST_MIX_PRICE_CENTS).toBe(14900)
  })

  test('currency is always usd', () => {
    expect(CURRENCY).toBe('usd')
  })
})
