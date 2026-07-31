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

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  })

  test('returns 400 when email is missing', async () => {
    const req = createMockRequest({})

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Email is required.' })
  })

  test('sends the reset link through the auth callback', async () => {
    const supabase = createSupabaseMock()
    supabase.auth.resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })

    const req = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@test.com',
      {
        redirectTo:
          'http://localhost:3000/auth/callback?next=%2Fauth%2Fupdate-password',
      },
    )
  })

  test('pins the reset link to the canonical origin in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const supabase = createSupabaseMock()
    supabase.auth.resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue(supabase)
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })

    const req = new Request('http://internal/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-host': 'attacker.example',
      },
      body: JSON.stringify({ email: 'user@test.com' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@test.com',
      {
        redirectTo:
          'https://nova-spatial.com/auth/callback?next=%2Fauth%2Fupdate-password',
      },
    )
  })
})
