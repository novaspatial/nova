import type { NextConfig } from 'next'
import { buildSecurityHeaders, supabaseAssetHost } from '@/lib/security/csp'

// TypeScript config so the security headers come from one tested module
// (src/lib/security/csp.ts) instead of being hand-maintained here (#50).
// Next transpiles this file through SWC with the tsconfig path aliases, so
// anything imported here must stay free of runtime/`server-only` imports.
const supabaseHostname = supabaseAssetHost()

const nextConfig: NextConfig = {
  // Ensure the static brand font is traced into the share-image route's
  // serverless bundle on Vercel (the `new URL(import.meta.url)` reference
  // usually suffices, but this makes it explicit).
  outputFileTracingIncludes: {
    '/blog/[slug]/share-image': ['./src/lib/blog/fonts/**'],
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/blog-assets/**',
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
      {
        source: '/videos/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
