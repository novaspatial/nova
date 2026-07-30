import { resolveRedirectOrigin } from './redirectOrigin'

function request(url: string, forwardedHost?: string) {
  return new Request(
    url,
    forwardedHost ? { headers: { 'x-forwarded-host': forwardedHost } } : {},
  )
}

describe('resolveRedirectOrigin', () => {
  test('returns the request origin outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(
      resolveRedirectOrigin(
        request('http://localhost:3000/auth/callback', 'anything.example'),
      ),
    ).toBe('http://localhost:3000')
  })

  test('accepts the canonical host and its www sibling in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(
      resolveRedirectOrigin(
        request('http://internal/auth/callback', 'nova-spatial.com'),
      ),
    ).toBe('https://nova-spatial.com')
    expect(
      resolveRedirectOrigin(
        request('http://internal/auth/callback', 'www.nova-spatial.com'),
      ),
    ).toBe('https://www.nova-spatial.com')
  })

  test('accepts a platform-supplied Vercel host', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_URL', 'nova-abc123.vercel.app')
    expect(
      resolveRedirectOrigin(
        request('http://internal/auth/callback', 'nova-abc123.vercel.app'),
      ),
    ).toBe('https://nova-abc123.vercel.app')
  })

  test('falls back to the canonical site for a spoofed host', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(
      resolveRedirectOrigin(
        request('http://internal/auth/callback', 'attacker.example'),
      ),
    ).toBe('https://nova-spatial.com')
  })

  test('ignores everything after the first entry of a chained header', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(
      resolveRedirectOrigin(
        request(
          'http://internal/auth/callback',
          'attacker.example, nova-spatial.com',
        ),
      ),
    ).toBe('https://nova-spatial.com')
  })
})
