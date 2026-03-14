import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createSupabaseMock } from '@/test/helpers/supabaseMock'

const mockLookup = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: (...args: unknown[]) => mockLookup(...args),
  },
  lookup: (...args: unknown[]) => mockLookup(...args),
}))

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET } from './route'

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  })

  test('returns 204 when no auth cookie is present', async () => {
    const res = await GET(new Request('http://localhost:3000/api/auth/me'))

    expect(res.status).toBe(204)
    expect(mockLookup).not.toHaveBeenCalled()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('returns 204 when the Supabase host is unreachable', async () => {
    mockLookup.mockRejectedValue(new Error('dns failed'))

    const res = await GET(
      new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(res.status).toBe(204)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('returns 204 when client creation fails', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    mockCreateClient.mockResolvedValue(null)

    const res = await GET(
      new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(res.status).toBe(204)
  })

  test('returns 204 when the authenticated user is missing', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET(
      new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(res.status).toBe(204)
  })

  test('returns minimal user data when a session exists', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock()
    supabase.auth.getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@test.com',
          user_metadata: {
            full_name: 'Test User',
          },
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET(
      new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie:
            'foo=bar; sb-project-auth-token=token; sb-project-auth-token.0=chunk',
        },
      }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'user@test.com',
        user_metadata: {
          full_name: 'Test User',
        },
      },
    })
  })

  test('returns 204 when getUser throws', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock()
    supabase.auth.getUser = vi.fn().mockRejectedValue(new Error('network down'))
    mockCreateClient.mockResolvedValue(supabase)

    const res = await GET(
      new Request('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: 'sb-project-auth-token=token',
        },
      }),
    )

    expect(res.status).toBe(204)
  })
})
