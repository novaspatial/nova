import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createSupabaseMock, createMockRequest } from '@/test/helpers/supabaseMock'

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

import { POST } from './route'

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  })

  test('returns 500 when auth client is unavailable', async () => {
    mockCreateClient.mockResolvedValue(null)

    const req = createMockRequest(
      { email: 'user@test.com', password: 'secret123' },
      { method: 'POST' },
    )

    const res = await POST(req)

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Authentication is not configured.',
    })
  })

  test('returns 400 when email or password is missing', async () => {
    const supabase = createSupabaseMock()
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({ email: 'user@test.com' })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Email and password are required.',
    })
    expect(mockLookup).not.toHaveBeenCalled()
  })

  test('returns 503 when Supabase hostname is unreachable', async () => {
    const supabase = createSupabaseMock()
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockRejectedValue(new Error('dns failed'))

    const req = createMockRequest({
      email: 'user@test.com',
      password: 'secret123',
    })

    const res = await POST(req)

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      error:
        'Unable to reach the authentication service. Please try again in a moment.',
    })
  })

  test('passes next and promoCode through to signUp', async () => {
    const supabase = createSupabaseMock()
    supabase.auth.signUp = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@test.com',
        password: 'secret123',
        promoCode: 'LAUNCH',
        next: '/portal/project-1',
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'secret123',
      options: {
        emailRedirectTo:
          'http://localhost:3000/auth/callback?next=%2Fportal%2Fproject-1',
        data: {
          promo_code: 'LAUNCH',
        },
      },
    })
  })

  test('falls back to /portal for unsafe next values', async () => {
    const supabase = createSupabaseMock()
    supabase.auth.signUp = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })

    const req = new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@test.com',
        password: 'secret123',
        next: 'https://evil.test/steal',
      }),
    })

    await POST(req)

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo:
            'http://localhost:3000/auth/callback?next=%2Fportal',
        }),
      }),
    )
  })

  test('normalizes network signup errors to 503', async () => {
    const supabase = createSupabaseMock()
    supabase.auth.signUp = vi.fn().mockResolvedValue({
      error: { message: 'NetworkError when attempting to fetch resource.', status: 0 },
    })
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })

    const req = createMockRequest({
      email: 'user@test.com',
      password: 'secret123',
    })

    const res = await POST(req)

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      error:
        'Unable to reach the authentication service. Please try again in a moment.',
    })
  })
})
