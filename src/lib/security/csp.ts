// The site's security headers, extracted from next.config so they can be
// tested (#50). Loaded by the Next config through SWC's require hook, so
// this module must stay pure: no `server-only`, no Next runtime imports,
// no side effects, and every environment read inside a function body.

export const CSP_REPORT_PATH = '/api/csp-report'
export const CSP_REPORT_GROUP = 'csp-endpoint'

export type CspMode = 'enforce' | 'report-only'

/**
 * The policy is compiled into the build, so switching modes needs a
 * redeploy — it is a staged-rollout lever, not a live kill switch.
 * Currently defaults to report-only: the site takes card payments, and a
 * missing host would break checkout until the next deploy. Flip to
 * `enforce` once the report endpoint has been quiet for a soak window.
 */
export function resolveCspMode(raw = process.env.CSP_MODE): CspMode {
  return raw === 'enforce' ? 'enforce' : 'report-only'
}

export function supabaseAssetHost(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function buildContentSecurityPolicy(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const host = supabaseAssetHost(env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseOrigin = host ? `https://${host}` : null
  const supabaseSocket = host ? `wss://${host}` : null
  const isDev = env.NODE_ENV !== 'production'

  // Stripe.js needs more hosts than the old policy listed: a fraud-signal
  // iframe on m.stripe.network and telemetry beacons to r./m.stripe.com.
  // Report-Only was hiding that; enforcing without them breaks checkout.
  const directives: Array<[string, Array<string | null>]> = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        "'unsafe-inline'",
        'https://js.stripe.com',
        // HMR and React Refresh only; production has no eval anywhere.
        isDev ? "'unsafe-eval'" : null,
        isDev ? 'https://va.vercel-scripts.com' : null,
      ],
    ],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', 'https://*.stripe.com', supabaseOrigin]],
    ['font-src', ["'self'", 'data:']],
    ['media-src', ["'self'", 'blob:', supabaseOrigin]],
    [
      'connect-src',
      [
        "'self'",
        'https://api.stripe.com',
        'https://r.stripe.com',
        'https://m.stripe.com',
        supabaseOrigin,
        supabaseSocket,
        isDev ? 'https://va.vercel-scripts.com' : null,
        isDev ? 'ws://localhost:*' : null,
        isDev ? 'http://localhost:*' : null,
      ],
    ],
    [
      'frame-src',
      [
        'https://js.stripe.com',
        'https://hooks.stripe.com',
        'https://m.stripe.network',
      ],
    ],
    ['worker-src', ["'self'", 'blob:']],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['object-src', ["'none'"]],
    ['report-uri', [CSP_REPORT_PATH]],
    // Pairs with the Reporting-Endpoints header, which needs an absolute
    // origin to be valid — no origin, no group to point at.
    ['report-to', [absoluteSiteOrigin(env) ? CSP_REPORT_GROUP : null]],
  ]

  return directives
    .map(([name, tokens]): [string, string[]] => [name, tokens.filter(Boolean) as string[]])
    // A directive with every token filtered out (report-to without an
    // origin) is dropped rather than emitted bare.
    .filter(([, tokens]) => tokens.length > 0)
    .map(([name, tokens]) => [name, ...tokens].join(' '))
    .join('; ')
}


// This module is loaded by next.config.ts through SWC's require hook,
// which resolves the config's own alias imports but not transitive ones —
// so the canonical origin is read from the environment here rather than
// imported from @/lib/site.
//
// Vercel's system vars are the fallback because production shipped with no
// Reporting-Endpoints header at all: NEXT_PUBLIC_SITE_URL is unset in the
// build env, so half the reporting wiring was dark and violations arrived
// only through the deprecated report-uri channel. The chain gates the
// production var on VERCEL_ENV deliberately — VERCEL_PROJECT_PRODUCTION_URL
// points at production even on preview builds, and a preview emitting the
// production endpoint would post cross-origin to a route that answers no
// CORS preflight. A hardcoded prod fallback (as in @/lib/site) would have
// the same flaw, plus a second copy of the domain to drift.
function absoluteSiteOrigin(env: NodeJS.ProcessEnv): string | null {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return new URL(candidate).origin
    } catch {
      // A malformed value falls through to the next candidate rather than
      // dropping the header entirely.
    }
  }
  return null
}

export function buildSecurityHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Array<{ key: string; value: string }> {
  const mode = resolveCspMode(env.CSP_MODE)
  const siteOrigin = absoluteSiteOrigin(env)

  return [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    // Reporting-Endpoints needs an absolute URL; browsers ignore a
    // relative one, so the header is omitted rather than sent broken when
    // the canonical origin isn't configured (report-uri still works —
    // it accepts a relative path).
    ...(siteOrigin
      ? [
          {
            key: 'Reporting-Endpoints',
            value: `${CSP_REPORT_GROUP}="${siteOrigin}${CSP_REPORT_PATH}"`,
          },
        ]
      : []),
    {
      key:
        mode === 'enforce'
          ? 'Content-Security-Policy'
          : 'Content-Security-Policy-Report-Only',
      value: buildContentSecurityPolicy(env),
    },
  ]
}
