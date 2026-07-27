import 'server-only'

import { SITE_URL, absoluteUrl } from '@/lib/site'

const ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Notify search engines that the given URLs changed, via IndexNow.
 *
 * One ping fans out to the participating engines (Bing, Yandex, Seznam, Naver,
 * Yep). Google does NOT participate and has no lightweight ping — its discovery
 * path is robots.txt + the sitemap, not this.
 *
 * Best-effort by contract: it no-ops when `INDEXNOW_KEY` is unset (dev, preview,
 * tests) or there are no URLs, and it never throws — a failed ping must never
 * disrupt the publish action that triggered it. The shared key is served at
 * `/indexnow-key.txt` and referenced via `keyLocation`, so it lives only in env.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY
  if (!key || urls.length === 0) return

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key,
        keyLocation: absoluteUrl('/indexnow-key.txt'),
        urlList: urls,
      }),
    })
    if (!res.ok) {
      console.error('[indexnow] ping rejected', res.status)
    } else {
      console.log('[indexnow] ping accepted', res.status)
    }
  } catch (err) {
    console.error('[indexnow] ping failed', err)
  }
}
