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

export async function isContactRateLimited(
  serviceSupabase: SupabaseClient,
  { email, ipHash }: { email: string; ipHash: string | null },
): Promise<{ limited: boolean; error: string | null }> {
  const windowStart = new Date(
    Date.now() - CONTACT_RATE_WINDOW_SECONDS * 1000,
  ).toISOString()

  const filter = ipHash
    ? `email.eq.${email},ip_hash.eq.${ipHash}`
    : `email.eq.${email}`

  const { count, error } = await serviceSupabase
    .from('contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', windowStart)
    .or(filter)

  if (error) return { limited: false, error: error.message }
  return { limited: (count ?? 0) >= CONTACT_RATE_MAX, error: null }
}
