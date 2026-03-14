import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateServerClient = vi.fn()
const mockCookies = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))

vi.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
}))

describe('supabaseServer', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey
  })

  test('returns null when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const { createClient } = await import('./supabaseServer')

    await expect(createClient()).resolves.toBeNull()
    expect(mockCookies).not.toHaveBeenCalled()
    expect(mockCreateServerClient).not.toHaveBeenCalled()
  })

  test('creates a server client with delegated cookie helpers', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
    const cookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: 'sb-auth', value: 'token' }]),
      set: vi.fn(),
    }
    const serverClient = { auth: {} }
    mockCookies.mockResolvedValue(cookieStore)
    mockCreateServerClient.mockReturnValue(serverClient)

    const { createClient } = await import('./supabaseServer')
    const client = await createClient()

    expect(client).toBe(serverClient)
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'publishable-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    )

    const options = mockCreateServerClient.mock.calls[0]?.[2] as {
      cookies: {
        getAll: () => unknown
        setAll: (
          cookiesToSet: Array<{ name: string; value: string; options?: object }>,
        ) => void
      }
    }

    expect(options.cookies.getAll()).toEqual([{ name: 'sb-auth', value: 'token' }])

    options.cookies.setAll([
      { name: 'sb-auth', value: 'token-2', options: { path: '/' } },
    ])
    expect(cookieStore.set).toHaveBeenCalledWith('sb-auth', 'token-2', { path: '/' })
  })

  test('swallows cookie set errors in server components', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
    const cookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn().mockImplementation(() => {
        throw new Error('readonly cookies')
      }),
    }
    mockCookies.mockResolvedValue(cookieStore)
    mockCreateServerClient.mockReturnValue({ auth: {} })

    const { createClient } = await import('./supabaseServer')
    await createClient()

    const options = mockCreateServerClient.mock.calls[0]?.[2] as {
      cookies: {
        setAll: (
          cookiesToSet: Array<{ name: string; value: string; options?: object }>,
        ) => void
      }
    }

    expect(() =>
      options.cookies.setAll([
        { name: 'sb-auth', value: 'token-2', options: { path: '/' } },
      ]),
    ).not.toThrow()
  })
})
