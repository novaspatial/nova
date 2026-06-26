import { describe, expect, test } from 'vitest'

import { SITE_URL, absoluteUrl } from '@/lib/site'
import { getAuthor } from '@/lib/team'
import {
  buildPostJsonLd,
  buildPostMetadata,
  resolvePostOgImage,
} from './metadata'
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

describe('resolvePostOgImage', () => {
  test('uses the first inline image (the on-page hero)', () => {
    expect(resolvePostOgImage(makePost())).toBe('https://cdn.example/hero.jpg')
  })

  test('falls back to the site default when the post has no image', () => {
    const post = makePost({ body: '## Just text\n\nNo images here.' })
    expect(resolvePostOgImage(post)).toBe(absoluteUrl('/og-image.jpg'))
  })

  test('resolves a relative image path against the canonical host', () => {
    const post = makePost({ body: '![local](/uploads/x.jpg)' })
    expect(resolvePostOgImage(post)).toBe(absoluteUrl('/uploads/x.jpg'))
  })
})

describe('buildPostMetadata', () => {
  test('emits per-post canonical, article OpenGraph, and Twitter card', () => {
    const meta = buildPostMetadata(makePost())

    expect(meta.title).toBe('My Post')
    expect(meta.description).toBe('A short description.')
    expect(meta.alternates?.canonical).toBe('/blog/my-post')
    expect(meta.authors).toEqual([{ name: 'Jamie Kuse' }])

    expect(meta.openGraph).toMatchObject({
      type: 'article',
      url: `${SITE_URL}/blog/my-post`,
      title: 'My Post',
      publishedTime: '2026-06-21T10:00:00Z',
      modifiedTime: '2026-06-22T12:00:00Z',
      authors: ['Jamie Kuse'],
      images: [
        {
          url: 'https://cdn.example/hero.jpg',
          width: 1200,
          height: 630,
          alt: 'My Post',
        },
      ],
    })

    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'My Post',
      images: ['https://cdn.example/hero.jpg'],
    })
  })

  test('omits publishedTime when the post is unpublished', () => {
    const meta = buildPostMetadata(makePost({ published_at: null }))
    expect(meta.openGraph).toMatchObject({ publishedTime: undefined })
  })
})

describe('buildPostJsonLd', () => {
  test('produces BlogPosting structured data with author and dates', () => {
    const jsonLd = buildPostJsonLd(makePost())

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'My Post',
      description: 'A short description.',
      image: 'https://cdn.example/hero.jpg',
      datePublished: '2026-06-21T10:00:00Z',
      dateModified: '2026-06-22T12:00:00Z',
      author: { '@type': 'Person', name: 'Jamie Kuse' },
      url: `${SITE_URL}/blog/my-post`,
      mainEntityOfPage: { '@id': `${SITE_URL}/blog/my-post` },
    })
  })

  test('falls back to post_date when published_at is null', () => {
    const jsonLd = buildPostJsonLd(makePost({ published_at: null }))
    expect(jsonLd.datePublished).toBe('2026-06-20')
  })
})
