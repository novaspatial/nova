import { SITE_URL } from '@/lib/site'

/**
 * Decide which origin an auth redirect may land on (#56).
 *
 * The callback used to trust `x-forwarded-host` verbatim, so a spoofed
 * header sent the post-sign-in redirect (and its `code`-bearing URL) to any
 * host. The header is only honored when it names a host we know: the
 * canonical site, its `www.` sibling, or a host the platform itself gave us
 * through the `VERCEL_*` env vars — never a wildcard suffix match.
 *
 * Outside production the request origin is returned unchanged, so
 * localhost ports, LAN IPs, and tunnels keep working in development.
 */
export function resolveRedirectOrigin(request: Request): string {
  const requestUrl = new URL(request.url)
  if (process.env.NODE_ENV !== 'production') {
    return requestUrl.origin
  }

  const canonicalHost = new URL(SITE_URL).host
  const allowed = new Set(
    [
      canonicalHost,
      `www.${canonicalHost}`,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter((host): host is string => Boolean(host))
      .map((host) => host.toLowerCase()),
  )

  // Chained proxies send a comma-separated list; the first entry is the
  // host the client actually asked for.
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()

  if (forwardedHost && allowed.has(forwardedHost)) {
    return `https://${forwardedHost}`
  }
  if (allowed.has(requestUrl.host.toLowerCase())) {
    return requestUrl.origin
  }
  return SITE_URL
}
