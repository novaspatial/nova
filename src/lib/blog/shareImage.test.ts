// @vitest-environment node
//
// Runs in the node env (not jsdom): `loadOgFont` resolves the font via
// `new URL('./fonts/…', import.meta.url)`, and jsdom's URL global would rewrite
// that file: URL to http://localhost, breaking the disk read. This module needs
// no DOM, so node is both correct and closer to the real runtime.
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getAuthor } from '@/lib/team'
import {
  loadOgFont,
  loadShareBackground,
  resolveShareCardProps,
} from './shareImage'
import type { BlogPostWithAuthor } from './types'

const author = getAuthor('jamie-kuse')!

function makePost(
  overrides: Partial<BlogPostWithAuthor> = {},
): BlogPostWithAuthor {
  return {
    id: 'p1',
    slug: 'my-post',
    title: 'My Post',
    description: 'A short description.',
    body: '![Studio shot](https://cdn.example/hero.jpg)\n\n## Heading\n\nText.',
    author_key: 'jamie-kuse',
    post_date: '2026-06-20',
    published_at: '2026-06-21T10:00:00Z',
    created_by: null,
    created_at: '2026-06-19T00:00:00Z',
    updated_at: '2026-06-22T12:00:00Z',
    author,
    ...overrides,
  }
}

function mockFetchOnce({
  ok = true,
  contentType = 'image/jpeg' as string | null,
  body = new Uint8Array([1, 2, 3, 4]),
} = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type' ? contentType : null,
    },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveShareCardProps', () => {
  test('returns title, author name, and the hero URL', () => {
    expect(resolveShareCardProps(makePost())).toEqual({
      title: 'My Post',
      authorName: 'Jamie Kuse',
      heroUrl: 'https://cdn.example/hero.jpg',
    })
  })

  test('heroUrl is null when the post has no inline image', () => {
    const props = resolveShareCardProps(makePost({ body: '## Just text' }))
    expect(props.heroUrl).toBeNull()
  })
})

describe('loadShareBackground', () => {
  test('returns null for a null hero URL without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadShareBackground(null)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('returns a data URI for a JPEG hero', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ contentType: 'image/jpeg' }))
    expect(await loadShareBackground('https://cdn.example/h.jpg')).toMatch(
      /^data:image\/jpeg;base64,/,
    )
  })

  test('strips charset and accepts PNG', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ contentType: 'image/png; charset=binary' }),
    )
    expect(await loadShareBackground('https://cdn.example/h.png')).toMatch(
      /^data:image\/png;base64,/,
    )
  })

  test('returns null for an unsupported type (webp)', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ contentType: 'image/webp' }))
    expect(await loadShareBackground('https://cdn.example/h.webp')).toBeNull()
  })

  test('returns null on a non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false }))
    expect(await loadShareBackground('https://cdn.example/miss.jpg')).toBeNull()
  })

  test('returns null for an empty body', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ body: new Uint8Array([]) }))
    expect(await loadShareBackground('https://cdn.example/h.jpg')).toBeNull()
  })

  test('returns null when the fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await loadShareBackground('https://cdn.example/h.jpg')).toBeNull()
  })
})

describe('loadOgFont', () => {
  test('reads the committed static brand font from disk', async () => {
    const font = await loadOgFont()
    expect(font).not.toBeNull()
    expect(font!.byteLength).toBeGreaterThan(0)
  })
})
