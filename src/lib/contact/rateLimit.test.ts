import {
  CONTACT_RATE_MAX,
  hashClientIp,
  isContactRateLimited,
} from './rateLimit'

type Supabase = Parameters<typeof isContactRateLimited>[0]

/**
 * One chain per `from()` call, so the per-key counts can answer
 * differently. `counts` is keyed by the column the query filters on.
 */
function supabaseReturning({
  counts = {},
  error,
}: {
  counts?: { email?: number; ip_hash?: number }
  error?: { message: string }
}) {
  const calls: Array<{ column: string; value: string }> = []
  const from = vi.fn(() => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      eq: vi.fn((column: string, value: string) => {
        calls.push({ column, value })
        return Promise.resolve({
          count: counts[column as keyof typeof counts] ?? 0,
          error: error ?? null,
        })
      }),
    }
    return chain
  })
  return { supabase: { from } as unknown as Supabase, calls, from }
}

describe('hashClientIp', () => {
  test('hashes the first x-forwarded-for entry and never returns the address', () => {
    const hash = hashClientIp(
      new Request('https://example.com', {
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      }),
    )
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain('203.0.113.7')
  })

  test('returns null when no client IP header is present', () => {
    expect(hashClientIp(new Request('https://example.com'))).toBeNull()
  })
})

describe('isContactRateLimited', () => {
  test('allows a sender below the threshold', async () => {
    const { supabase } = supabaseReturning({
      counts: { email: CONTACT_RATE_MAX - 1, ip_hash: CONTACT_RATE_MAX - 1 },
    })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' }),
    ).resolves.toEqual({ limited: false, error: null })
  })

  test('limits at the threshold on the email key', async () => {
    const { supabase } = supabaseReturning({
      counts: { email: CONTACT_RATE_MAX, ip_hash: 0 },
    })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' }),
    ).resolves.toEqual({ limited: true, error: null })
  })

  test('limits at the threshold on the IP key alone', async () => {
    const { supabase } = supabaseReturning({
      counts: { email: 0, ip_hash: CONTACT_RATE_MAX },
    })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' }),
    ).resolves.toEqual({ limited: true, error: null })
  })

  test('counts each key with its own equality filter', async () => {
    const { supabase, calls } = supabaseReturning({ counts: {} })
    await isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' })
    expect(calls).toEqual([
      { column: 'email', value: 'a@b.co' },
      { column: 'ip_hash', value: 'abc' },
    ])
  })

  test('falls back to the email alone when the IP is unknown', async () => {
    const { supabase, calls, from } = supabaseReturning({ counts: {} })
    await isContactRateLimited(supabase, { email: 'a@b.co', ipHash: null })
    expect(calls).toEqual([{ column: 'email', value: 'a@b.co' }])
    expect(from).toHaveBeenCalledTimes(1)
  })

  test('an address containing a comma still counts against its own window', async () => {
    // The regression: `EMAIL_PATTERN` admits commas, and the old `.or()`
    // filter took its values inline, so this address split the filter and
    // the per-email bound stopped binding. As one `.eq()` value it cannot.
    const evil = 'a,ip_hash.eq.0000@example.com'
    const { supabase, calls } = supabaseReturning({
      counts: { email: CONTACT_RATE_MAX },
    })

    await expect(
      isContactRateLimited(supabase, { email: evil, ipHash: null }),
    ).resolves.toEqual({ limited: true, error: null })
    expect(calls).toEqual([{ column: 'email', value: evil }])
  })

  test('surfaces a lookup failure instead of silently allowing', async () => {
    const { supabase } = supabaseReturning({ error: { message: 'boom' } })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: null }),
    ).resolves.toEqual({ limited: false, error: 'boom' })
  })
})
