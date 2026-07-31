import * as Sentry from '@sentry/nextjs'

/**
 * The one place errors leave the app (#59).
 *
 * Everything routes through here rather than calling Sentry directly, so
 * the vendor stays one import deep and the no-DSN path is a single
 * behaviour rather than a per-call-site guess. With no DSN configured
 * `Sentry.captureException` is a no-op, so the console line is what
 * survives — which is exactly today's behaviour, and why this can ship
 * before the DSN is provisioned.
 *
 * Nothing here throws: a reporting failure must never become the error
 * the user sees.
 */

export type ErrorContext = Record<string, string | number | boolean | null>

export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    Sentry.captureException(error, { extra: context })
  } catch {
    // Reporting is best-effort by construction.
  }
  console.error('[error]', error, context)
}

/**
 * Money-path anomalies are their own signal, not just another error.
 *
 * The four call sites (webhook user_id/project_id, payment-status
 * song_count/add_ons) all detect the same class of thing: Stripe's
 * verified metadata disagreeing with the row we are about to treat as
 * paid. Each one refuses the claim and answers 200 — correct, because
 * retrying is not the fix — which means without this the signal existed
 * only as a log line nobody reads. A tamper attempt on the order path is
 * worth waking up for, so it is captured at `error` level with a
 * fingerprint per kind, and the message is written to be legible in an
 * alert email.
 *
 * Deliberately carries IDs only — never amounts, emails, or card data.
 */
export function alertMoneyPathAnomaly(anomaly: {
  kind: string
  intentId: string | null
  projectId: string | null
  expected?: string | number | null
  actual?: string | number | null
}): void {
  const message = `Money-path anomaly: ${anomaly.kind}`
  try {
    Sentry.captureMessage(message, {
      level: 'error',
      fingerprint: ['money-path', anomaly.kind],
      extra: {
        intentId: anomaly.intentId,
        projectId: anomaly.projectId,
        expected: anomaly.expected ?? null,
        actual: anomaly.actual ?? null,
      },
    })
  } catch {
    // Same contract as reportError: never throw from the alert path.
  }
  console.error(`[money-path] ${anomaly.kind}`, {
    intent: anomaly.intentId,
    project: anomaly.projectId,
    expected: anomaly.expected ?? null,
    actual: anomaly.actual ?? null,
  })
}

/**
 * Whether a DSN is configured — the honest answer to "is anything
 * actually receiving these?". Exposed so the ops checklist on #59 has a
 * machine-checkable receipt instead of a promise.
 */
export function isErrorReportingConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SENTRY_DSN)
}
