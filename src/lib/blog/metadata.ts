import type { Metadata } from 'next'

import { SITE_NAME, absoluteUrl } from '@/lib/site'
import { extractHeroImage } from './extractHeroImage'
import type { BlogPostWithAuthor } from './types'

/** Root default Open Graph image, used when a post has no inline image. */
const DEFAULT_OG_IMAGE = '/og-image.jpg'

/**
 * Resolve the absolute Open Graph image URL for a post.
 *
 * Per decision D8 the hero/OG image is the post's first inline markdown image
 * (the same one rendered as the on-page hero). Posts without an image fall back
 * to the site-wide default. Supabase image URLs are already absolute; a relative
 * path is resolved against the canonical host.
 */
export function resolvePostOgImage(post: BlogPostWithAuthor): string {
  const src = extractHeroImage(post.body).hero?.src
  if (!src) return absoluteUrl(DEFAULT_OG_IMAGE)
  return /^https?:\/\//.test(src) ? src : absoluteUrl(src)
}

/**
 * Build per-post `<head>` metadata: title, description, canonical URL, and
 * Open Graph / Twitter tags. Used by the post route's `generateMetadata`.
 */
export function buildPostMetadata(post: BlogPostWithAuthor): Metadata {
  const path = `/blog/${post.slug}`
  const url = absoluteUrl(path)
  const ogImage = resolvePostOgImage(post)

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author.name }],
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url,
      siteName: SITE_NAME,
      title: post.title,
      description: post.description,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: [post.author.name],
      images: [
        { url: ogImage, width: 1200, height: 630, alt: post.title },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  }
}

/**
 * Build the schema.org `BlogPosting` JSON-LD object embedded on the post page,
 * so search engines get structured article data (author, dates, canonical URL).
 */
export function buildPostJsonLd(post: BlogPostWithAuthor): Record<string, unknown> {
  const url = absoluteUrl(`/blog/${post.slug}`)

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: resolvePostOgImage(post),
    datePublished: post.published_at ?? post.post_date,
    dateModified: post.updated_at,
    author: { '@type': 'Person', name: post.author.name },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  }
}
