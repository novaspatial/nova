/**
 * The site's single canonical address.
 *
 * Everything that needs an absolute URL — page metadata, the sitemap,
 * Open Graph / Twitter tags, and search-engine pings — must derive it from
 * here so there is exactly one source of truth for the host. Don't hard-code
 * the domain anywhere else.
 *
 * Defaults to the bare production domain; override with `NEXT_PUBLIC_SITE_URL`
 * (e.g. on preview deployments). The `www` host redirects to the bare domain
 * at the infrastructure layer, so it never appears here.
 */
const FALLBACK_SITE_URL = 'https://nova-spatial.com'

/** Canonical origin, with no trailing slash (e.g. `https://nova-spatial.com`). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '')

/** Human-readable site / brand name. */
export const SITE_NAME = 'NOVA Spatial'

/** Resolve a root-relative path to an absolute URL on the canonical host. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString()
}
