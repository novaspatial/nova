import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined)

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { checkEmail } from './checkEmail'

describe('checkEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns false when auth is not configured', async () => {
    mockCreateClient.mockResolvedValue(null)

    await expect(checkEmail('user@test.com')).resolves.toEqual({ exists: false })
  })

  test('returns false for not-found style OTP errors', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          error: { message: 'User not found' },
        }),
      },
    })

    await expect(checkEmail('user@test.com')).resolves.toEqual({ exists: false })
  })

  test('returns false when OTP signups are disabled', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({
          error: { message: 'Signups not allowed for otp' },
        }),
      },
    })

    await expect(checkEmail('user@test.com')).resolves.toEqual({ exists: false })
  })

  test('treats rate-limited OTP requests as existing users', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      error: {
        message:
          'For security purposes, you can only request this once every 60 seconds',
      },
    })
    mockCreateClient.mockResolvedValue({
      auth: { signInWithOtp },
    })

    await expect(checkEmail('user@test.com')).resolves.toEqual({ exists: true })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'user@test.com',
      options: {
        shouldCreateUser: false,
      },
    })
  })

  test('returns false when signInWithOtp throws', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithOtp: vi.fn().mockRejectedValue(new Error('boom')),
      },
    })

    await expect(checkEmail('user@test.com')).resolves.toEqual({ exists: false })
    expect(mockConsoleError).toHaveBeenCalled()
  })
})
