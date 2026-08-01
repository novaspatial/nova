// PAYMENTS_DEV_BYPASS skips Stripe and mints born-paid $0 projects — a
// local-development convenience that must be impossible to arm on any
// deployed environment (#45).
//
// The bypass is refused on Vercel outright, preview included. There is a
// single Supabase project and no branches, so a preview deploy talks to the
// production database: an armed bypass there mints born-paid $0 rows in real
// data, burns real discount reservations, and sends real "Total: $0.00"
// receipts. Preview being publicly reachable (absent Deployment Protection)
// makes that anyone's to trigger, which is #45's original failure scenario
// reached through the Preview env scope rather than Production.
//
// Smoke-testing checkout on a preview deploy therefore uses a Stripe test
// card, which exercises more of the flow than the bypass ever did — the
// bypass skips Stripe entirely.
//
// NODE_ENV alone cannot express this: Vercel builds preview with
// NODE_ENV=production too, and conversely vitest runs under NODE_ENV=test
// where the bypass must stay usable. So presence-on-Vercel and
// NODE_ENV=production (for non-Vercel production hosting) are separate gates.
export function isPaymentsDevBypassEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const onVercel = Boolean(env.VERCEL || env.VERCEL_ENV)
  const isProduction = env.NODE_ENV === 'production'
  return !onVercel && !isProduction && env.PAYMENTS_DEV_BYPASS === 'true'
}
