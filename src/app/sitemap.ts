import type { MetadataRoute } from 'next'

import { loadPublishedPosts } from '@/lib/blog/posts'
import { absoluteUrl } from '@/lib/site'

/**
 * Always-current sitemap: the marketing pages plus every published blog post.
 *
 * Posts come from `loadPublishedPosts`, the same query `/blog` and `/blog/[slug]`
 * render with, so the sitemap can't list a post the site would 404 (drafts and
 * unknown-author posts are already excluded there). That query reads the
 * cookie-based server client, which makes this route dynamic — intentional, so a
 * publish is reflected immediately. `loadPublishedPosts` returns `[]` on error,
 * so the sitemap degrades to the static pages rather than throwing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await loadPublishedPosts()

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.8 },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.8 },
    { url: absoluteUrl('/blog'), changeFrequency: 'weekly', priority: 0.7 },
  ]

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updated_at),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticPages, ...postPages]
}
