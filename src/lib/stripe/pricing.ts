export const FULL_PRICE_CENTS = 29900
export const FIRST_MIX_PRICE_CENTS = 14900
export const CURRENCY = 'usd'

export function computePrice(hasFirstMixDiscount: boolean) {
  return {
    amountCents: hasFirstMixDiscount ? FIRST_MIX_PRICE_CENTS : FULL_PRICE_CENTS,
    currency: CURRENCY,
  }
}
