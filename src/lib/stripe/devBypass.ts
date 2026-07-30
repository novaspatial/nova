// PAYMENTS_DEV_BYPASS skips Stripe and mints born-paid $0 projects — a
// dev/preview convenience that must be impossible to arm in production
// (#45). VERCEL_ENV is checked before NODE_ENV because Vercel preview
// deploys also build with NODE_ENV=production; bare NODE_ENV is the
// fallback for non-Vercel production hosting.
export function isPaymentsDevBypassEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const isProduction =
    env.VERCEL_ENV === 'production' ||
    (!env.VERCEL_ENV && env.NODE_ENV === 'production')
  return !isProduction && env.PAYMENTS_DEV_BYPASS === 'true'
}
