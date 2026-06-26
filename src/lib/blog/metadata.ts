import type { Metadata } from 'next'

import { SITE_NAME, absoluteUrl } from '@/lib/site'
import { extractHeroImage } from './extractHeroImage'
import type { BlogPostWithAuthor } from './types'

/** Root default Open Graph image, used when a post has no inline image. */
const DEFAULT_OG_IMAGE = '/og-image.jpg'

/**
 * The post's own hero image — the first inline markdown image (decision D8) —
 * as an absolute URL, or `null` when the post has no image. Supabase URLs are
 * already absolute; a relative path is resolved against the canonical host.
 */
export function resolvePostHeroImage(post: BlogPostWithAuthor): string | null {
  const src = extractHeroImage(post.body).hero?.src
  if (!src) return null
  return /^https?:\/\//.test(src) ? src : absoluteUrl(src)
}

/**
 * Resolve the absolute Open Graph image URL for a post, used by the JSON-LD
 * `image` field. Falls back to the site-wide default when the post has no image.
 */
export function resolvePostOgImage(post: BlogPostWithAuthor): string {
  return resolvePostHeroImage(post) ?? absoluteUrl(DEFAULT_OG_IMAGE)
}

/**
 * Absolute URL of the post's auto-generated share card (#21 / S13). The
 * `share-image` Route Handler renders the title over the hero in the brand
 * font; this is what social crawlers fetch as the og/twitter image.
 */
export function postShareImageUrl(post: BlogPostWithAuthor): string {
  return absoluteUrl(`/blog/${post.slug}/share-image`)
}

/**
 * Build per-post `<head>` metadata: title, description, canonical URL, and
 * Open Graph / Twitter tags. Used by the post route's `generateMetadata`.
 */
export function buildPostMetadata(post: BlogPostWithAuthor): Metadata {
  const path = `/blog/${post.slug}`
  const url = absoluteUrl(path)
  const shareImage = postShareImageUrl(post)

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
        { url: shareImage, width: 1200, height: 630, alt: post.title },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [shareImage],
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
