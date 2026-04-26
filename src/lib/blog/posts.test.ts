import { describe, expect, test, vi, beforeEach } from 'vitest'

const supabaseCreate = vi.fn()

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => supabaseCreate(...args),
}))

type Filter = { col: string; op: 'is' | 'eq'; value: unknown }

function makeSupabaseStub({
  rows = [] as unknown[],
  error = null as { message: string } | null,
}: {
  rows?: unknown[]
  error?: { message: string } | null
} = {}) {
  const filters: Filter[] = []
  let orderCol: string | null = null
  let orderDesc = false
  let limited: 'maybeSingle' | 'list' = 'list'

  const builder = {
    select: vi.fn(() => builder),
    not: vi.fn((col: string, op: 'is', value: unknown) => {
      filters.push({ col, op, value })
      return builder
    }),
    eq: vi.fn((col: string, value: unknown) => {
      filters.push({ col, op: 'eq', value })
      return builder
    }),
    order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
      orderCol = col
      orderDesc = opts?.ascending === false
      return Promise.resolve({ data: rows, error })
    }),
    maybeSingle: vi.fn(() => {
      limited = 'maybeSingle'
      return Promise.resolve({ data: rows[0] ?? null, error })
    }),
  }
  const from = vi.fn(() => builder)
  return {
    client: { from },
    inspect: () => ({ filters, orderCol, orderDesc, limited }),
  }
}

describe('blog/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadPublishedPosts', () => {
    test('returns [] when supabase is not configured', async () => {
      supabaseCreate.mockResolvedValueOnce(null)
      const { loadPublishedPosts } = await import('./posts')
      await expect(loadPublishedPosts()).resolves.toEqual([])
    })

    test('queries blog_posts, filters by published_at IS NOT NULL, and orders by post_date desc', async () => {
      const stub = makeSupabaseStub({ rows: [] })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPublishedPosts } = await import('./posts')
      await loadPublishedPosts()

      expect(stub.client.from).toHaveBeenCalledWith('blog_posts')
      const { filters, orderCol, orderDesc } = stub.inspect()
      expect(filters).toContainEqual({
        col: 'published_at',
        op: 'is',
        value: null,
      })
      expect(orderCol).toBe('post_date')
      expect(orderDesc).toBe(true)
    })

    test('returns [] when the query errors', async () => {
      const stub = makeSupabaseStub({
        rows: [],
        error: { message: 'rls denied' },
      })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPublishedPosts } = await import('./posts')
      await expect(loadPublishedPosts()).resolves.toEqual([])
    })

    test('attaches author from team.ts and drops rows whose author_key is unknown', async () => {
      const stub = makeSupabaseStub({
        rows: [
          {
            id: '1',
            slug: 'a',
            title: 'A',
            description: 'd',
            body: 'b',
            author_key: 'jamie-kuse',
            post_date: '2026-04-25',
            published_at: '2026-04-25T00:00:00Z',
            created_by: null,
            created_at: '2026-04-25T00:00:00Z',
            updated_at: '2026-04-25T00:00:00Z',
          },
          {
            id: '2',
            slug: 'b',
            title: 'B',
            description: 'd',
            body: 'b',
            author_key: 'who-dis',
            post_date: '2026-04-25',
            published_at: '2026-04-25T00:00:00Z',
            created_by: null,
            created_at: '2026-04-25T00:00:00Z',
            updated_at: '2026-04-25T00:00:00Z',
          },
        ],
      })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPublishedPosts } = await import('./posts')
      const posts = await loadPublishedPosts()
      expect(posts).toHaveLength(1)
      expect(posts[0]).toMatchObject({
        slug: 'a',
        author: expect.objectContaining({ slug: 'jamie-kuse' }),
      })
    })
  })

  describe('loadPostBySlug', () => {
    test('returns null when supabase is not configured', async () => {
      supabaseCreate.mockResolvedValueOnce(null)
      const { loadPostBySlug } = await import('./posts')
      await expect(loadPostBySlug('x')).resolves.toBeNull()
    })

    test('filters by slug and by published_at IS NOT NULL (drafts are not visible)', async () => {
      const stub = makeSupabaseStub({ rows: [] })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPostBySlug } = await import('./posts')
      const out = await loadPostBySlug('hello')
      expect(out).toBeNull()

      const { filters, limited } = stub.inspect()
      expect(filters).toContainEqual({ col: 'slug', op: 'eq', value: 'hello' })
      expect(filters).toContainEqual({
        col: 'published_at',
        op: 'is',
        value: null,
      })
      expect(limited).toBe('maybeSingle')
    })

    test('returns the post with author when found', async () => {
      const stub = makeSupabaseStub({
        rows: [
          {
            id: '1',
            slug: 'hello',
            title: 'Hi',
            description: 'd',
            body: '## hi',
            author_key: 'will-howie',
            post_date: '2026-04-25',
            published_at: '2026-04-25T00:00:00Z',
            created_by: null,
            created_at: '2026-04-25T00:00:00Z',
            updated_at: '2026-04-25T00:00:00Z',
          },
        ],
      })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPostBySlug } = await import('./posts')
      const post = await loadPostBySlug('hello')
      expect(post).toMatchObject({
        slug: 'hello',
        title: 'Hi',
        author: expect.objectContaining({ slug: 'will-howie' }),
      })
    })

    test('returns null when the row exists but the author is unknown', async () => {
      const stub = makeSupabaseStub({
        rows: [
          {
            id: '1',
            slug: 'orphan',
            title: 't',
            description: 'd',
            body: 'b',
            author_key: 'ghost',
            post_date: '2026-04-25',
            published_at: '2026-04-25T00:00:00Z',
            created_by: null,
            created_at: '2026-04-25T00:00:00Z',
            updated_at: '2026-04-25T00:00:00Z',
          },
        ],
      })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadPostBySlug } = await import('./posts')
      await expect(loadPostBySlug('orphan')).resolves.toBeNull()
    })
  })

  describe('loadAllPostsForAdmin', () => {
    test('does NOT filter by published_at (drafts must be visible to admins)', async () => {
      const stub = makeSupabaseStub({ rows: [] })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadAllPostsForAdmin } = await import('./posts')
      await loadAllPostsForAdmin()

      const { filters, orderCol, orderDesc } = stub.inspect()
      expect(filters).not.toContainEqual(
        expect.objectContaining({ col: 'published_at' }),
      )
      expect(orderCol).toBe('updated_at')
      expect(orderDesc).toBe(true)
    })
  })

  describe('loadAdminPostById', () => {
    test('returns null when supabase is not configured', async () => {
      supabaseCreate.mockResolvedValueOnce(null)
      const { loadAdminPostById } = await import('./posts')
      await expect(loadAdminPostById('post-id')).resolves.toBeNull()
    })

    test('looks up by id without the published_at filter', async () => {
      const stub = makeSupabaseStub({
        rows: [
          {
            id: 'post-id',
            slug: 'draft',
            title: 't',
            description: 'd',
            body: 'b',
            author_key: 'jamie-kuse',
            post_date: '2026-04-25',
            // Draft: no published_at
            published_at: null,
            created_by: null,
            created_at: '2026-04-25T00:00:00Z',
            updated_at: '2026-04-25T00:00:00Z',
          },
        ],
      })
      supabaseCreate.mockResolvedValueOnce(stub.client)

      const { loadAdminPostById } = await import('./posts')
      const post = await loadAdminPostById('post-id')
      expect(post).toMatchObject({ id: 'post-id', published_at: null })

      const { filters, limited } = stub.inspect()
      expect(filters).toContainEqual({ col: 'id', op: 'eq', value: 'post-id' })
      expect(filters).not.toContainEqual(
        expect.objectContaining({ col: 'published_at' }),
      )
      expect(limited).toBe('maybeSingle')
    })
  })
})
