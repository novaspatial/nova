import { describe, expect, test, vi, beforeEach } from 'vitest'

const requireApiProfile = vi.fn()

vi.mock('@/lib/auth/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/server')>(
    '@/lib/auth/server',
  )
  return {
    ...actual,
    requireApiProfile: (...args: unknown[]) => requireApiProfile(...args),
  }
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/portal/admin/blog/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPayload = {
  title: 'Test',
  slug: 'test',
  description: 'A test',
  body: '## Hello',
  author_key: 'jamie-kuse',
  post_date: '2026-04-25',
}

describe('POST /api/portal/admin/blog/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when there is no session', async () => {
    requireApiProfile.mockResolvedValueOnce({
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      }),
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(401)
  })

  test('returns 403 when the caller is not a studio user', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: {} as never,
      user: { id: 'u1' } as never,
      profile: { id: 'u1', email: null, display_name: null, avatar_url: null, role: 'client' },
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(403)
  })

  test('returns 400 when author_key is unknown', async () => {
    const insert = vi.fn()
    requireApiProfile.mockResolvedValueOnce({
      supabase: {
        from: () => ({
          insert: () => ({ select: () => ({ single: insert }) }),
        }),
      } as never,
      user: { id: 'u1' } as never,
      profile: { id: 'u1', email: null, display_name: null, avatar_url: null, role: 'studio' },
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({ ...validPayload, author_key: 'nobody' }) as never,
    )
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  test('inserts the row when called by a studio user', async () => {
    const single = vi.fn().mockResolvedValueOnce({
      data: { id: 'post-id' },
      error: null,
    })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))

    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: { id: 'u1', email: null, display_name: null, avatar_url: null, role: 'studio' },
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'post-id' })
    expect(from).toHaveBeenCalledWith('blog_posts')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'test',
        author_key: 'jamie-kuse',
        created_by: 'u1',
      }),
    )
  })
})
