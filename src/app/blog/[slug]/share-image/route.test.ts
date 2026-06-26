import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getAuthor } from '@/lib/team'
import type { BlogPostWithAuthor } from '@/lib/blog/types'

const {
  imageResponseMock,
  loadPostBySlugMock,
  loadOgFontMock,
  loadShareBackgroundMock,
} = vi.hoisted(() => ({
  imageResponseMock: vi.fn(),
  loadPostBySlugMock: vi.fn(),
  loadOgFontMock: vi.fn(),
  loadShareBackgroundMock: vi.fn(),
}))

vi.mock('next/og', () => ({ ImageResponse: imageResponseMock }))
vi.mock('@/lib/blog/posts', () => ({ loadPostBySlug: loadPostBySlugMock }))
// Keep the pure resolver real; stub only the disk/network loaders.
vi.mock('@/lib/blog/shareImage', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/blog/shareImage')>(
      '@/lib/blog/shareImage',
    )
  return {
    ...actual,
    loadOgFont: loadOgFontMock,
    loadShareBackground: loadShareBackgroundMock,
  }
})

import { GET } from './route'

const author = getAuthor('jamie-kuse')!

function makePost(
  overrides: Partial<BlogPostWithAuthor> = {},
): BlogPostWithAuthor {
  return {
    id: 'p1',
    slug: 'my-post',
    title: 'My Post',
    description: 'A short description.',
    body: '![Studio shot](https://cdn.example/hero.jpg)\n\n## Heading',
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

function call(slug: string) {
  return GET(new Request('https://nova-spatial.com/'), {
    params: Promise.resolve({ slug }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  loadOgFontMock.mockResolvedValue(Buffer.from([1, 2, 3]))
  loadShareBackgroundMock.mockResolvedValue(null)
})

describe('GET /blog/[slug]/share-image', () => {
  test('404s for an unknown / unpublished slug without rendering', async () => {
    loadPostBySlugMock.mockResolvedValue(null)

    const res = await call('nope')

    expect(res.status).toBe(404)
    expect(imageResponseMock).not.toHaveBeenCalled()
  })

  test('renders a 1200x630 image in the brand font for a published post', async () => {
    loadPostBySlugMock.mockResolvedValue(makePost())
    loadShareBackgroundMock.mockResolvedValue('data:image/jpeg;base64,AAAA')

    await call('my-post')

    expect(imageResponseMock).toHaveBeenCalledTimes(1)
    // The hero URL from the post flows through to the background loader.
    expect(loadShareBackgroundMock).toHaveBeenCalledWith(
      'https://cdn.example/hero.jpg',
    )

    const [, options] = imageResponseMock.mock.calls[0]
    expect(options.width).toBe(1200)
    expect(options.height).toBe(630)
    expect(options.fonts).toHaveLength(1)
    expect(options.fonts[0]).toMatchObject({ name: 'Mona Sans', weight: 600 })
    expect(options.headers['Cache-Control']).toContain('s-maxage=86400')
  })

  test('omits fonts so Next falls back when the brand font is unavailable', async () => {
    loadPostBySlugMock.mockResolvedValue(makePost())
    loadOgFontMock.mockResolvedValue(null)

    await call('my-post')

    const [, options] = imageResponseMock.mock.calls[0]
    expect(options.fonts).toBeUndefined()
  })
})
