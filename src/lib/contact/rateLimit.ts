import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Abuse bounds for the public contact form (#51), the same shape as the
 * checkout limiter: count recent rows, refuse past the threshold.
 *
 * Counting happens on the service client because the submitter's own
 * session cannot read `contact_inquiries` (there is no SELECT policy) and
 * must not be able to.
 */
export const CONTACT_RATE_WINDOW_SECONDS = 600
export const CONTACT_RATE_MAX = 3

/**
 * Store a hash, never the address: the table is a marketing inbox, not a
 * log, and a hash is enough to rate-limit on.
 */
export function hashClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip')?.trim()
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex')
}

/**
 * Two separate counts rather than one `.or()` filter, deliberately: the
 * `or=` grammar is comma-delimited and takes its values inline, while
 * `EMAIL_PATTERN` admits commas and parens in the local part — so an
 * address like `a,ip_hash.eq.0@x.com` used to split the filter and drop
 * the per-email bound (or malform the query into a 500). `.eq()` carries
 * the value as one encoded parameter with no composite grammar, so there
 * is nothing left to escape.
 *
 * The thresholds are now per key: three from one address and three from
 * one IP each trip independently, where the old filter pooled them. That
 * is the more honest bound — a shared NAT address should not spend a
 * sender's allowance.
 */
export async function isContactRateLimited(
  serviceSupabase: SupabaseClient,
  { email, ipHash }: { email: string; ipHash: string | null },
): Promise<{ limited: boolean; error: string | null }> {
  const windowStart = new Date(
    Date.now() - CONTACT_RATE_WINDOW_SECONDS * 1000,
  ).toISOString()

  const countRecent = (column: 'email' | 'ip_hash', value: string) =>
    serviceSupabase
      .from('contact_inquiries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', windowStart)
      .eq(column, value)

  const [byEmail, byIp] = await Promise.all([
    countRecent('email', email),
    ipHash ? countRecent('ip_hash', ipHash) : null,
  ])

  const error = byEmail.error ?? byIp?.error ?? null
  if (error) return { limited: false, error: error.message }

  const limited =
    (byEmail.count ?? 0) >= CONTACT_RATE_MAX ||
    (byIp?.count ?? 0) >= CONTACT_RATE_MAX
  return { limited, error: null }
}
