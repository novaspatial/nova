import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createSupabaseMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { POST } from './route'

function createFormRequest(
  fields: Record<string, string>,
  options: { url?: string; headers?: Record<string, string> } = {},
) {
  return new Request(options.url || 'http://localhost:3000/api/auth/confirm', {
    method: 'POST',
    headers: options.headers,
    body: new URLSearchParams(fields),
  })
}

function mockVerifyOtp(result: { error: null | Record<string, unknown> }) {
  const supabase = createSupabaseMock()
  supabase.auth.verifyOtp = vi.fn().mockResolvedValue(result)
  mockCreateClient.mockResolvedValue(supabase)
  return supabase
}

describe('POST /api/auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
  })

  test('verifies a signup token and redirects to next', async () => {
    const supabase = mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup', next: '/portal' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/portal')
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'signup',
      token_hash: 'abc',
    })
  })

  test('defaults a recovery confirmation to the update-password page', async () => {
    mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'recovery' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/auth/update-password',
    )
  })

  test('drops an off-origin next before redirecting (#56)', async () => {
    mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest({
        token_hash: 'abc',
        type: 'signup',
        next: '//attacker.example',
      }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/portal')
  })

  test('rejects a missing token without touching Supabase', async () => {
    const res = await POST(createFormRequest({ type: 'signup' }))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('rejects a type outside the allowlist without touching Supabase', async () => {
    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'magiclink' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  test('maps an otp_expired error to the friendly login message', async () => {
    mockVerifyOtp({
      error: {
        code: 'otp_expired',
        message: 'Email link is invalid or has expired',
        status: 403,
      },
    })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=confirm-link-used',
    )
  })

  test('classifies a consumed token by message when no code is present', async () => {
    mockVerifyOtp({
      error: { message: 'One-time token not found', status: 403 },
    })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=confirm-link-used',
    )
  })

  test('routes a used/expired recovery link to reset guidance, not "just sign in"', async () => {
    mockVerifyOtp({
      error: { code: 'otp_expired', message: 'Email link is invalid or has expired', status: 403 },
    })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'recovery' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=recovery-link-used',
    )
  })

  test('does not mislabel an unrelated error sharing the fallback words (#e.g. misconfig)', async () => {
    // Same message shape a bad API key produces, but not scoped to verify's
    // 403 and carrying no otp_expired code — must not read as a used link.
    mockVerifyOtp({ error: { message: 'Invalid API key', status: 401 } })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
  })

  test('sends the unspent token back to the confirm page on a network error', async () => {
    mockVerifyOtp({ error: { message: 'fetch failed', status: 0 } })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup', next: '/portal' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/auth/confirm?token_hash=abc&type=signup&next=%2Fportal&error=retry',
    )
  })

  test('treats a GoTrue/gateway 5xx as retryable, not a used link', async () => {
    mockVerifyOtp({
      error: {
        name: 'AuthRetryableFetchError',
        __isAuthError: true,
        message: '{}',
        status: 503,
      },
    })

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup', next: '/portal' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/auth/confirm?token_hash=abc&type=signup&next=%2Fportal&error=retry',
    )
  })

  test('rejects a cross-site POST before spending the token', async () => {
    const supabase = mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest(
        { token_hash: 'abc', type: 'signup' },
        { headers: { 'sec-fetch-site': 'cross-site' } },
      ),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
  })

  test('rejects a mismatched Origin header before spending the token', async () => {
    const supabase = mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest(
        { token_hash: 'abc', type: 'signup' },
        { headers: { origin: 'https://attacker.example' } },
      ),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled()
  })

  test('allows a same-origin POST carrying Sec-Fetch-Site and Origin', async () => {
    mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest(
        { token_hash: 'abc', type: 'signup', next: '/portal' },
        {
          headers: {
            'sec-fetch-site': 'same-origin',
            origin: 'http://localhost:3000',
          },
        },
      ),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3000/portal')
  })

  test('fails safe when the Supabase client is not configured', async () => {
    mockCreateClient.mockResolvedValue(null)

    const res = await POST(
      createFormRequest({ token_hash: 'abc', type: 'signup' }),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
  })

  test('pins the redirect to the canonical origin in production (#56)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mockVerifyOtp({ error: null })

    const res = await POST(
      createFormRequest(
        { token_hash: 'abc', type: 'signup', next: '/portal' },
        {
          url: 'http://internal/api/auth/confirm',
          headers: { 'x-forwarded-host': 'attacker.example' },
        },
      ),
    )

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://nova-spatial.com/portal')
  })

  test('treats an unparseable body as an invalid link', async () => {
    const res = await POST(createMockRequest({ token_hash: 'abc' }))

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth-code-error',
    )
  })
})
