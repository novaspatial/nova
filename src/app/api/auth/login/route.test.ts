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

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  })

  test('returns 400 when email or password is missing', async () => {
    const req = createMockRequest({ email: 'user@test.com' })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Email and password are required.',
    })
    expect(mockLookup).not.toHaveBeenCalled()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('returns 503 when Supabase hostname is unreachable', async () => {
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
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('returns 500 when auth client is unavailable', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    mockCreateClient.mockResolvedValue(null)

    const req = createMockRequest({
      email: 'user@test.com',
      password: 'secret123',
    })

    const res = await POST(req)

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Authentication is not configured.',
    })
  })

  test('returns 400 when Supabase returns an auth error', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock()
    supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Invalid login credentials', status: 400 },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      email: 'user@test.com',
      password: 'wrong',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid login credentials',
    })
  })

  test('normalizes fetch failures to 503', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock()
    supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'fetch failed', status: 0 },
    })
    mockCreateClient.mockResolvedValue(supabase)

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

  test('returns 200 when login succeeds', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    const supabase = createSupabaseMock()
    supabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: null,
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest({
      email: 'user@test.com',
      password: 'secret123',
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'secret123',
    })
  })
})
