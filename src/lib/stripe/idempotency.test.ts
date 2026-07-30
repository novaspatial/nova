import {
  buildCheckoutIdempotencyKey,
  IDEMPOTENCY_BUCKET_SECONDS,
} from './idempotency'

const order = { amountCents: 32500, songCount: 1, addOns: [] }
const t0 = 1_800_000_000_000

describe('buildCheckoutIdempotencyKey', () => {
  test('a resubmit of the same order in the same window reuses the key', () => {
    expect(buildCheckoutIdempotencyKey('user-1', order, t0)).toBe(
      buildCheckoutIdempotencyKey('user-1', order, t0 + 1000),
    )
  })

  test('a different order gets a different key', () => {
    expect(buildCheckoutIdempotencyKey('user-1', order, t0)).not.toBe(
      buildCheckoutIdempotencyKey('user-1', { ...order, songCount: 2 }, t0),
    )
  })

  test('a different owner gets a different key', () => {
    expect(buildCheckoutIdempotencyKey('user-1', order, t0)).not.toBe(
      buildCheckoutIdempotencyKey('user-2', order, t0),
    )
  })

  test('the same order in a later window gets a new key, so a real repeat order still works', () => {
    expect(buildCheckoutIdempotencyKey('user-1', order, t0)).not.toBe(
      buildCheckoutIdempotencyKey(
        'user-1',
        order,
        t0 + IDEMPOTENCY_BUCKET_SECONDS * 2000,
      ),
    )
  })

  test('keys stay within Stripe key length limits', () => {
    const key = buildCheckoutIdempotencyKey('user-1', order, t0)
    expect(key).toMatch(/^checkout_[a-f0-9]{48}$/)
    expect(key.length).toBeLessThanOrEqual(255)
  })
})
