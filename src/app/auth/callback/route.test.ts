import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from './route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  test('redirects to login when auth code is missing', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
  })

  test('redirects to login when code exchange fails', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          error: { message: 'bad code' },
        }),
      },
    })

    const res = await GET(
      new Request('http://localhost:3000/auth/callback?code=abc&next=/portal'),
    )

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
  })

  test('redirects to forwarded host outside local development', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          error: null,
        }),
      },
    })

    const res = await GET(
      new Request('http://internal/auth/callback?code=abc&next=/portal', {
        headers: {
          'x-forwarded-host': 'nova.example.com',
        },
      }),
    )

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://nova.example.com/portal')
  })

  test('redirects to the origin during development', async () => {
    process.env.NODE_ENV = 'development'
    mockCreateClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          error: null,
        }),
      },
    })

    const res = await GET(
      new Request('http://localhost:3000/auth/callback?code=abc&next=/profile'),
    )

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/profile')
  })
})
