import { ImageResponse } from 'next/og'

import { loadPostBySlug } from '@/lib/blog/posts'
import {
  ShareCard,
  loadOgFont,
  loadShareBackground,
  resolveShareCardProps,
} from '@/lib/blog/shareImage'

// satori reads the brand font from disk (decision D9), so this must be Node.
export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630

/**
 * Auto-generated per-post share image (#21 / S13). Renders the post title in the
 * brand font over its hero image; `buildPostMetadata` points the post's
 * og:image / twitter:image here. Only published posts resolve — `loadPostBySlug`
 * filters drafts, so they 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const post = await loadPostBySlug(slug)
  if (!post) return new Response('Not Found', { status: 404 })

  const { title, authorName, heroUrl } = resolveShareCardProps(post)
  const [font, backgroundDataUri] = await Promise.all([
    loadOgFont(),
    loadShareBackground(heroUrl),
  ])

  return new ImageResponse(
    (
      <ShareCard
        title={title}
        authorName={authorName}
        backgroundDataUri={backgroundDataUri}
      />
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font
        ? [{ name: 'Mona Sans', data: font, weight: 600 as const, style: 'normal' as const }]
        : undefined,
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
