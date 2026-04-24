import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  // Pin to the Stripe API version the integration was written against.
  // `apiVersion` in Stripe's types is narrowed to a single string literal
  // matching whichever version ships with the installed package, so the
  // cast decouples this code from that moving target without changing
  // what gets sent to Stripe at runtime.
  type ApiVersion = NonNullable<
    ConstructorParameters<typeof Stripe>[1]
  >['apiVersion']
  cached = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia' as ApiVersion,
  })
  return cached
}
