import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createSupabaseMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'

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

function mockResend(result: { error: null | Record<string, unknown> }) {
  const supabase = createSupabaseMock()
  supabase.auth.resend = vi.fn().mockResolvedValue(result)
  mockCreateClient.mockResolvedValue(supabase)
  mockLookup.mockResolvedValue({ address: '127.0.0.1' })
  return supabase
}

describe('POST /api/auth/resend-confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  })

  test('returns 400 when email is missing', async () => {
    const res = await POST(createMockRequest({}))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Email is required.' })
    expect(mockLookup).not.toHaveBeenCalled()
  })

  test('returns 503 when the Supabase host is unreachable', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'))

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(503)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('returns 500 when authentication is not configured', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1' })
    mockCreateClient.mockResolvedValue(null)

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Authentication is not configured.',
    })
  })

  test('resends the confirmation through the auth callback', async () => {
    const supabase = mockResend({ error: null })

    const req = new Request(
      'http://localhost:3000/api/auth/resend-confirmation',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', next: '/portal' }),
      },
    )

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'user@test.com',
      options: {
        emailRedirectTo:
          'http://localhost:3000/auth/callback?next=%2Fportal',
      },
    })
  })

  test('does not leak whether an account exists', async () => {
    mockResend({ error: { message: 'User not found', status: 400 } })

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  test("does not surface GoTrue's 429 cooldown (it correlates with account existence)", async () => {
    // over_email_send_rate_limit is only returned for a real, unconfirmed
    // account (GoTrue throttles per-user against confirmation_sent_at), so
    // passing it through verbatim would make this endpoint an oracle.
    mockResend({
      error: {
        message:
          'For security purposes, you can only request this after 53 seconds.',
        status: 429,
        code: 'over_email_send_rate_limit',
      },
    })

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  test('does not misclassify a GoTrue 5xx as an obfuscated failure (retryable)', async () => {
    mockResend({
      error: {
        name: 'AuthRetryableFetchError',
        __isAuthError: true,
        message: '{}',
        status: 503,
      },
    })

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      error:
        'Unable to reach the authentication service. Please try again in a moment.',
    })
  })

  test('normalizes network resend errors to 503', async () => {
    mockResend({ error: { message: 'fetch failed', status: 0 } })

    const res = await POST(createMockRequest({ email: 'user@test.com' }))

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toEqual({
      error:
        'Unable to reach the authentication service. Please try again in a moment.',
    })
  })

  test('pins the confirmation link to the canonical origin in production (#56)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const supabase = mockResend({ error: null })

    const req = new Request('http://internal/api/auth/resend-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-host': 'attacker.example',
      },
      body: JSON.stringify({ email: 'user@test.com', next: '/portal' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(supabase.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo:
            'https://nova-spatial.com/auth/callback?next=%2Fportal',
        },
      }),
    )
  })

  test('drops an unsafe next before building the redirect (#56)', async () => {
    const supabase = mockResend({ error: null })

    const res = await POST(
      createMockRequest({ email: 'user@test.com', next: '//attacker.example' }),
    )

    expect(res.status).toBe(200)
    expect(supabase.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo:
            'http://localhost:3000/auth/callback?next=%2Fportal',
        },
      }),
    )
  })
})
