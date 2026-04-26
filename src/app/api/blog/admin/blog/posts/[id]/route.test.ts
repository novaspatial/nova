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

type Params = { params: Promise<{ id: string }> }

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/blog/admin/blog/posts/post-id', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(): Request {
  return new Request('http://localhost/api/blog/admin/blog/posts/post-id', {
    method: 'DELETE',
  })
}

const params: Params = { params: Promise.resolve({ id: 'post-id' }) }

const studioProfile = {
  id: 'u1',
  email: null,
  display_name: null,
  avatar_url: null,
  role: 'studio' as const,
}

function makeUpdateChain(opts: {
  existingSlug?: string | null
  updateError?: { code?: string; message: string } | null
} = {}) {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
  }))
  const selectMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.existingSlug === undefined ? { slug: 'old-slug' } : opts.existingSlug === null ? null : { slug: opts.existingSlug },
    error: null,
  })
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: selectMaybeSingle }),
    }),
    update,
  }))
  return { from, update, selectMaybeSingle }
}

describe('PATCH /api/blog/admin/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when there is no session', async () => {
    requireApiProfile.mockResolvedValueOnce({
      response: new Response(null, { status: 401 }),
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ title: 'x' }) as never, params)
    expect(res.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 403 when caller is not a studio user', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: {} as never,
      user: { id: 'u1' } as never,
      profile: { ...studioProfile, role: 'client' },
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ title: 'x' }) as never, params)
    expect(res.status).toBe(403)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 400 when the body is not valid JSON', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: vi.fn() } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const req = new Request('http://localhost/api/blog/admin/blog/posts/post-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await PATCH(req as never, params)
    expect(res.status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 400 when author_key is set to an unknown slug', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from: vi.fn() } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ author_key: 'nobody' }) as never,
      params,
    )
    expect(res.status).toBe(400)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('updates fields and revalidates the index plus the existing slug', async () => {
    const { from, update } = makeUpdateChain({ existingSlug: 'old-slug' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ title: 'New title', body: '## New' }) as never,
      params,
    )
    expect(res.status).toBe(200)

    const updateArg = update.mock.calls[0][0]
    expect(updateArg).toMatchObject({ title: 'New title', body: '## New' })
    expect(typeof updateArg.updated_at).toBe('string')
    // Without an explicit published_at in the payload we must not touch it.
    expect(updateArg).not.toHaveProperty('published_at')

    expect(revalidatePath).toHaveBeenCalledWith('/blog')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/old-slug')
  })

  test('publishes the post by setting published_at and revalidates', async () => {
    const { from, update } = makeUpdateChain({ existingSlug: 'a-post' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ published_at: '2026-04-26T10:00:00Z' }) as never,
      params,
    )
    expect(res.status).toBe(200)
    expect(update.mock.calls[0][0]).toMatchObject({
      published_at: '2026-04-26T10:00:00Z',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/a-post')
  })

  test('unpublishes the post by passing published_at: null', async () => {
    const { from, update } = makeUpdateChain({ existingSlug: 'a-post' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ published_at: null }) as never,
      params,
    )
    expect(res.status).toBe(200)
    expect(update.mock.calls[0][0]).toMatchObject({ published_at: null })
  })

  test('revalidates both the old and new slug when the slug changes', async () => {
    const { from } = makeUpdateChain({ existingSlug: 'old-slug' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ slug: 'new-slug' }) as never,
      params,
    )
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/blog')
    expect(calls).toContain('/blog/old-slug')
    expect(calls).toContain('/blog/new-slug')
  })

  test('returns 409 when the new slug collides with an existing post', async () => {
    const { from } = makeUpdateChain({
      existingSlug: 'old-slug',
      updateError: { code: '23505', message: 'duplicate key value' },
    })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ slug: 'taken' }) as never,
      params,
    )
    expect(res.status).toBe(409)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 500 when the update fails for any other reason', async () => {
    const { from } = makeUpdateChain({
      existingSlug: 'old-slug',
      updateError: { message: 'db down' },
    })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ title: 'x' }) as never,
      params,
    )
    expect(res.status).toBe(500)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('ignores non-string fields in the payload (defends against type coercion)', async () => {
    const { from, update } = makeUpdateChain({ existingSlug: 'old-slug' })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ title: 42, slug: { drop: 'table' }, body: 'ok' }) as never,
      params,
    )
    expect(res.status).toBe(200)
    const updateArg = update.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('title')
    expect(updateArg).not.toHaveProperty('slug')
    expect(updateArg).toMatchObject({ body: 'ok' })
  })

  test('still revalidates the index even if the existing-slug lookup returns no row', async () => {
    const { from } = makeUpdateChain({ existingSlug: null })
    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ title: 'x' }) as never,
      params,
    )
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/blog')
    expect(calls).not.toContain('/blog/null')
    expect(calls).not.toContain('/blog/undefined')
  })
})

describe('DELETE /api/blog/admin/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when there is no session', async () => {
    requireApiProfile.mockResolvedValueOnce({
      response: new Response(null, { status: 401 }),
    })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteRequest() as never, params)
    expect(res.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('returns 403 when caller is not a studio user', async () => {
    requireApiProfile.mockResolvedValueOnce({
      supabase: {} as never,
      user: { id: 'u1' } as never,
      profile: { ...studioProfile, role: 'client' },
    })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteRequest() as never, params)
    expect(res.status).toBe(403)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  test('deletes the row and revalidates the index plus the deleted slug', async () => {
    const deleteEq = vi.fn().mockResolvedValueOnce({ error: null })
    const del = vi.fn(() => ({ eq: deleteEq }))
    const selectMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { slug: 'gone' }, error: null })
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: selectMaybeSingle }) }),
      delete: del,
    }))

    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteRequest() as never, params)
    expect(res.status).toBe(200)
    expect(del).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'post-id')
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/gone')
  })

  test('returns 500 when the delete fails', async () => {
    const deleteEq = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'fk constraint' } })
    const del = vi.fn(() => ({ eq: deleteEq }))
    const selectMaybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { slug: 'gone' }, error: null })
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: selectMaybeSingle }) }),
      delete: del,
    }))

    requireApiProfile.mockResolvedValueOnce({
      supabase: { from } as never,
      user: { id: 'u1' } as never,
      profile: studioProfile,
    })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteRequest() as never, params)
    expect(res.status).toBe(500)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
