import * as Sentry from '@sentry/nextjs'
import { initSentry } from '@/lib/observability/sentry'

// Browser-side init (#59). DSN-gated like the server side, so this ships
// inert: with no DSN nothing initializes and no request leaves the page.
initSentry()

// Lets Sentry tie errors to the route transition they happened during.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
