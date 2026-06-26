import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * Crawler instructions. Allows the public marketing site and blog, disallows the
 * whole non-public surface (APIs, auth, the client portal, and the blog admin),
 * and points crawlers at the sitemap. All absolute references use the canonical
 * origin from `@/lib/site`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/login', '/profile', '/portal/', '/blog/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
