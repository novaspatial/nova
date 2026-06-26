import 'server-only'

import { readFile } from 'node:fs/promises'

import { resolvePostHeroImage } from './metadata'
import type { BlogPostWithAuthor } from './types'

/**
 * Build the auto-generated share card for a post (#21 / S13): the post title in
 * the brand font over its hero image, with the NOVA Spatial wordmark and author
 * byline. Rendered by the `/blog/[slug]/share-image` Route Handler via `next/og`.
 *
 * All satori-specific logic (the card JSX, the static brand font, the controlled
 * background fetch) lives here so the route stays a thin shell.
 */

/** Static-weight brand font (satori cannot use the variable woff2). */
const FONT_URL = new URL(
  './fonts/MonaSansExpanded-SemiBold.ttf',
  import.meta.url,
)
/** Cap the background fetch so a huge upload can't blow up the render. */
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024
/** Abort a slow hero fetch rather than hang the image route. */
const BACKGROUND_FETCH_TIMEOUT_MS = 4000

// `undefined` = not loaded yet, `null` = load failed (don't retry).
let cachedFont: Buffer | null | undefined

/**
 * Read the static Mona-Sans weight from disk, cached for the lifetime of the
 * (warm) lambda. Returns `null` on any failure so the route can still render
 * with Next's bundled fallback font instead of 500-ing.
 */
export async function loadOgFont(): Promise<Buffer | null> {
  if (cachedFont !== undefined) return cachedFont
  try {
    cachedFont = await readFile(FONT_URL)
  } catch {
    cachedFont = null
  }
  return cachedFont
}

/**
 * Fetch the hero image and return it as a `data:` URI satori can embed inline.
 *
 * We fetch it ourselves (rather than letting satori fetch the `<img src>`) so we
 * control the failure modes: only JPEG/PNG pass — satori/resvg can't reliably
 * decode the webp/avif an author may have uploaded — and everything else
 * (no image, slow fetch, oversize, wrong type, network error) returns `null`,
 * which the card renders as the brand gradient.
 */
export async function loadShareBackground(
  heroUrl: string | null,
): Promise<string | null> {
  if (!heroUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    BACKGROUND_FETCH_TIMEOUT_MS,
  )
  try {
    const res = await fetch(heroUrl, { signal: controller.signal })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type')?.split(';')[0].trim()
    if (contentType !== 'image/jpeg' && contentType !== 'image/png') return null

    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BACKGROUND_BYTES) {
      return null
    }
    return `data:${contentType};base64,${bytes.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Title + author + hero source for the card (pure; the route resolves the bg). */
export function resolveShareCardProps(post: BlogPostWithAuthor): {
  title: string
  authorName: string
  heroUrl: string | null
} {
  return {
    title: post.title,
    authorName: post.author.name,
    heroUrl: resolvePostHeroImage(post),
  }
}

type ShareCardProps = {
  title: string
  authorName: string
  /** Inline `data:` URI from `loadShareBackground`, or `null` for the gradient. */
  backgroundDataUri: string | null
}

/** The 1200×630 share-card element handed to `ImageResponse`. */
export function ShareCard({
  title,
  authorName,
  backgroundDataUri,
}: ShareCardProps) {
  const titleSize = title.length > 55 ? 60 : 76

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#09090b',
        fontFamily: 'Mona Sans',
      }}
    >
      {backgroundDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundDataUri}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            objectFit: 'cover',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          width: 1200,
          height: 630,
          backgroundImage: backgroundDataUri
            ? 'linear-gradient(to top, rgba(9,9,11,0.97) 0%, rgba(9,9,11,0.62) 42%, rgba(9,9,11,0.18) 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 48%, #4e0e52 100%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              width: 40,
              height: 40,
              borderRadius: 10,
              marginRight: 18,
              backgroundColor: '#8b5cf6',
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: '#fafafa',
            }}
          >
            NOVA Spatial
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
              overflow: 'hidden',
              fontSize: titleSize,
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: -1,
              color: '#fafafa',
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 28,
              color: '#c4b5fd',
            }}
          >
            {authorName}
          </div>
        </div>
      </div>
    </div>
  )
}
