import { describe, expect, test, vi } from 'vitest'

const loadPublishedPosts = vi.fn()
vi.mock('@/lib/blog/posts', () => ({
  loadPublishedPosts: (...args: unknown[]) => loadPublishedPosts(...args),
}))

import sitemap from './sitemap'

describe('sitemap', () => {
  test('lists the marketing pages with absolute URLs and no lastModified', async () => {
    loadPublishedPosts.mockResolvedValueOnce([])

    const entries = await sitemap()

    expect(entries.map((e) => e.url)).toEqual([
      'https://nova-spatial.com/',
      'https://nova-spatial.com/about',
      'https://nova-spatial.com/contact',
      'https://nova-spatial.com/terms',
      'https://nova-spatial.com/blog',
    ])
    expect(entries.every((e) => e.lastModified === undefined)).toBe(true)
  })

  test('appends one entry per published post, lastModified from updated_at', async () => {
    loadPublishedPosts.mockResolvedValueOnce([
      { slug: 'first-post', updated_at: '2026-06-20T10:00:00.000Z' },
      { slug: 'second-post', updated_at: '2026-06-25T08:30:00.000Z' },
    ])

    const entries = await sitemap()

    expect(entries.slice(5)).toEqual([
      {
        url: 'https://nova-spatial.com/blog/first-post',
        lastModified: new Date('2026-06-20T10:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: 'https://nova-spatial.com/blog/second-post',
        lastModified: new Date('2026-06-25T08:30:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
    ])
  })

  test('falls back to the static pages only when there are no posts', async () => {
    loadPublishedPosts.mockResolvedValueOnce([])
    const entries = await sitemap()
    expect(entries).toHaveLength(5)
  })
})
