import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  // Pinned deliberately, and re-pinned to the installed SDK's own version
  // (#59): the previous pin had drifted two releases behind, and the cast
  // that made that possible also hid the drift. Omitting `apiVersion`
  // entirely would let an SDK upgrade change wire behavior silently, so
  // the pin stays — bump it together with the `stripe` dependency.
  cached = new Stripe(key, {
    apiVersion: '2026-05-27.dahlia',
  })
  return cached
}
