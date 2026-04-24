import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const loadStripeMock = vi.fn()
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => loadStripeMock(...args),
}))

describe('getStripePromise', () => {
  const originalKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    loadStripeMock.mockReset()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    } else {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalKey
    }
  })

  test('resolves to null (and logs) when publishable key is not set', async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    const { getStripePromise } = await import('./client')

    const result = await getStripePromise()
    expect(result).toBeNull()
    expect(loadStripeMock).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
  })

  test('caches the loadStripe promise across calls', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_xyz'
    const sentinel = { id: 'stripe-instance' }
    loadStripeMock.mockReturnValue(Promise.resolve(sentinel))

    const { getStripePromise } = await import('./client')
    const a = getStripePromise()
    const b = getStripePromise()

    expect(a).toBe(b)
    await expect(a).resolves.toBe(sentinel)
    expect(loadStripeMock).toHaveBeenCalledTimes(1)
    expect(loadStripeMock).toHaveBeenCalledWith('pk_test_xyz')
  })
})
