const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null
  } catch {
    return null
  }
})()

const supabaseOrigin = supabaseHostname ? `https://${supabaseHostname}` : ''
const supabaseSocket = supabaseHostname ? `wss://${supabaseHostname}` : ''

const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  `font-src 'self' data:`,
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  `connect-src 'self' https://api.stripe.com ${supabaseOrigin} ${supabaseSocket}`.trim(),
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
]
  .filter(Boolean)
  .join('; ')

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        headers: securityHeaders,
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
