import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// The Stripe constructor is cheap to instantiate but does validate the key
// shape. Mock the module so tests stay fast and env-independent.
vi.mock('stripe', () => {
  class FakeStripe {
    _key: string
    constructor(key: string) {
      this._key = key
    }
  }
  return { default: FakeStripe }
})

describe('getStripe', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = originalKey
  })

  test('throws when STRIPE_SECRET_KEY is unset', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const { getStripe } = await import('./server')
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/)
  })

  test('returns a cached Stripe instance across calls', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
    const { getStripe } = await import('./server')
    const a = getStripe()
    const b = getStripe()
    expect(a).toBe(b)
  })
})
