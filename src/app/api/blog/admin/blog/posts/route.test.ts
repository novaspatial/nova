import { describe, expect, test, vi, beforeEach } from 'vitest'

const requireApiProfile = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/server')>(
    '@/lib/auth/server',
  )
  return {
    ...actual,
    requireApiProfile: (...args: unknown[]) => requireApiProfile(...args),
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

const studioProfile = {
  id: 'u1',
  email: null,
  display_name: null,
  avatar_url: null,
  role: 'studio' as const,
}

function makeInsertChain(opts: {
  insertedId?: string | null
  insertError?: { code?: string; message: string } | null
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.insertedId ? { id: opts.insertedId } : null,
    error: opts.insertError ?? null,
  })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  return { from, insert, select, single }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/blog/admin/blog/posts', {
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

describe('POST /api/blog/admin/blog/posts', () => {
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
    const chain = makeInsertChain({ insertedId: 'post-id' })

    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: chain.from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ id: 'post-id' })
    expect(chain.from).toHaveBeenCalledWith('blog_posts')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'test',
        author_key: 'jamie-kuse',
        created_by: 'u1',
        published_at: null,
      }),
    )
  })

  test('returns 400 when the body is not valid JSON', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: vi.fn() } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/blog/admin/blog/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON body')
  })

  test.each([
    'title',
    'slug',
    'description',
    'body',
    'author_key',
    'post_date',
  ] as const)('returns 400 when %s is missing', async (field) => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: vi.fn() } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const payload = { ...validPayload, [field]: '' }
    const { POST } = await import('./route')
    const res = await POST(makeRequest(payload) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe(`Missing field: ${field}`)
  })

  test('returns 400 when the slug is not clean', async () => {
    const from = vi.fn()
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({ ...validPayload, slug: 'Not Clean' }) as never,
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/slug/i)
    expect(from).not.toHaveBeenCalled()
  })

  test('returns 400 when an image is missing alt text', async () => {
    const from = vi.fn()
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({
        ...validPayload,
        body: '![](https://cdn.example/x.jpg)',
      }) as never,
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/alt text/i)
    expect(from).not.toHaveBeenCalled()
  })

  test('returns 409 when the slug collides with an existing post', async () => {
    const chain = makeInsertChain({
      insertedId: null,
      insertError: { code: '23505', message: 'duplicate key value' },
    })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: chain.from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/already exists/i)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 500 on a generic insert error', async () => {
    const chain = makeInsertChain({
      insertedId: null,
      insertError: { message: 'db down' },
    })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: chain.from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(500)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('only revalidates the index when the post is created as a draft', async () => {
    const chain = makeInsertChain({ insertedId: 'post-id' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: chain.from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(validPayload) as never)
    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
    expect(revalidatePath).not.toHaveBeenCalledWith(`/blog/${validPayload.slug}`)
  })

  test('revalidates both the index and the post route when published immediately', async () => {
    const chain = makeInsertChain({ insertedId: 'post-id' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: chain.from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { POST } = await import('./route')
    const res = await POST(
      makeRequest({
        ...validPayload,
        published_at: '2026-04-26T10:00:00Z',
      }) as never,
    )
    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
    expect(revalidatePath).toHaveBeenCalledWith(`/blog/${validPayload.slug}`)
  })
})
