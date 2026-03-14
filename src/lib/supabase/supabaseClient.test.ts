import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateBrowserClient = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}))

describe('supabaseClient', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('@/lib/supabase/supabaseClient')
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey
  })

  test('returns null when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const { createClient } = await import('./supabaseClient')

    expect(createClient()).toBeNull()
    expect(mockCreateBrowserClient).not.toHaveBeenCalled()
  })

  test('creates a browser client when env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'
    const browserClient = { auth: {} }
    mockCreateBrowserClient.mockReturnValue(browserClient)

    const { createClient } = await import('./supabaseClient')

    expect(createClient()).toBe(browserClient)
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'publishable-key',
    )
  })
})
