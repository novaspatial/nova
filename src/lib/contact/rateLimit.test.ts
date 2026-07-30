import {
  CONTACT_RATE_MAX,
  hashClientIp,
  isContactRateLimited,
} from './rateLimit'

type Supabase = Parameters<typeof isContactRateLimited>[0]

function supabaseReturning(result: { count?: number; error?: { message: string } }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockResolvedValue({ count: result.count ?? 0, error: result.error ?? null }),
  }
  return {
    supabase: { from: vi.fn(() => chain) } as unknown as Supabase,
    chain,
  }
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
    const { supabase } = supabaseReturning({ count: CONTACT_RATE_MAX - 1 })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' }),
    ).resolves.toEqual({ limited: false, error: null })
  })

  test('limits at the threshold', async () => {
    const { supabase } = supabaseReturning({ count: CONTACT_RATE_MAX })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' }),
    ).resolves.toEqual({ limited: true, error: null })
  })

  test('matches on either the email or the IP hash', async () => {
    const { supabase, chain } = supabaseReturning({ count: 0 })
    await isContactRateLimited(supabase, { email: 'a@b.co', ipHash: 'abc' })
    expect(chain.or).toHaveBeenCalledWith('email.eq.a@b.co,ip_hash.eq.abc')
  })

  test('falls back to the email alone when the IP is unknown', async () => {
    const { supabase, chain } = supabaseReturning({ count: 0 })
    await isContactRateLimited(supabase, { email: 'a@b.co', ipHash: null })
    expect(chain.or).toHaveBeenCalledWith('email.eq.a@b.co')
  })

  test('surfaces a lookup failure instead of silently allowing', async () => {
    const { supabase } = supabaseReturning({ error: { message: 'boom' } })
    await expect(
      isContactRateLimited(supabase, { email: 'a@b.co', ipHash: null }),
    ).resolves.toEqual({ limited: false, error: 'boom' })
  })
})
