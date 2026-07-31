import * as Sentry from '@sentry/nextjs'

/**
 * One init shared by the server, edge and browser entry points (#59).
 *
 * DSN-gated: with `NEXT_PUBLIC_SENTRY_DSN` unset every runtime skips init
 * entirely, so this ships inert and starts reporting the moment the DSN
 * lands in the Vercel env — no code change, no redeploy beyond the env
 * one. `tracesSampleRate` stays 0: this is an error reporter, not an APM
 * install, and performance data would cost quota that the launch funnel
 * has no use for yet.
 */
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    // The portal moves audio and client contact details; default PII
    // collection has no upside here and a privacy-policy cost (#55).
    sendDefaultPii: false,
  })
}

// The CSP's matching connect-src token is derived from the same DSN, but
// `sentryIngestOrigin` lives in @/lib/security/csp rather than here:
// next.config loads that module through SWC's require hook, which does
// not resolve transitive alias imports, so it cannot import from this
// file. Keep the two in step if the DSN shape ever changes.
