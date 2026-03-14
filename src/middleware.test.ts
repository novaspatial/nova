import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockCreateServerClient = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))

describe('middleware', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey
  })

  test('skips auth entirely when Supabase env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const { middleware } = await import('./middleware')

    const response = await middleware(
      new NextRequest('http://localhost:3000/portal/project-1'),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })

  test('redirects unauthenticated requests when there is no auth cookie', async () => {
    const { middleware } = await import('./middleware')

    const response = await middleware(
      new NextRequest('http://localhost:3000/portal/project-1?tab=files'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fportal%2Fproject-1%3Ftab%3Dfiles',
    )
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })

  test('redirects to login and clears stale cookies when auth lookup fails', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockRejectedValue(new Error('network down')),
      },
    })
    const { middleware } = await import('./middleware')

    const response = await middleware(
      new NextRequest('http://localhost:3000/profile', {
        headers: {
          cookie:
            'sb-project-auth-token=token; sb-project-auth-token.0=chunk; theme=dark',
        },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fprofile',
    )
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('sb-project-auth-token=')
    expect(setCookie).toContain('sb-project-auth-token.0=')
  })

  test('redirects to login without clearing cookies when claims are empty', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: null },
        }),
      },
    })
    const { middleware } = await import('./middleware')

    const response = await middleware(
      new NextRequest('http://localhost:3000/portal', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fportal',
    )
    expect(response.headers.get('set-cookie') ?? '').not.toContain('Max-Age=0')
  })

  test('allows requests through when claims exist', async () => {
    mockCreateServerClient.mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: 'user-1' } },
        }),
      },
    })
    const { middleware } = await import('./middleware')

    const response = await middleware(
      new NextRequest('http://localhost:3000/portal/project-1', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
