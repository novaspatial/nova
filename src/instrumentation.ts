import * as Sentry from '@sentry/nextjs'
import { initSentry } from '@/lib/observability/sentry'

// Next runs this once per server/edge runtime start (#59). initSentry is
// DSN-gated, so with no DSN configured this is a no-op and the app
// behaves exactly as it did before.
export function register() {
  initSentry()
}

// Server-side render and route-handler errors Next catches before any of
// our own try/catch sees them.
export const onRequestError = Sentry.captureRequestError
