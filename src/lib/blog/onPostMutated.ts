import 'server-only'

import { revalidatePath } from 'next/cache'

import { absoluteUrl } from '@/lib/site'
import { pingIndexNow } from './indexnow'

export type PostMutationType = 'created' | 'updated' | 'deleted'

export type PostMutation = {
  type: PostMutationType
  /** The post's canonical slug after the mutation (null when it can't be resolved). */
  slug: string | null
  /** The prior slug, set only when an update changed it, so its old page is busted too. */
  previousSlug?: string | null
  /** Whether the post is publicly live after the mutation — false for drafts and deletes. */
  isPublished: boolean
  /** Whether the post was publicly live before the mutation — true means a takedown still needs a ping. */
  wasPublished: boolean
}

/**
 * The single hook that runs after any admin mutation to a blog post — create,
 * update, publish, unpublish, or delete. It centralizes every publish
 * side-effect so the admin save paths stay thin and behave consistently.
 *
 * Today it revalidates the affected Next.js cache paths. The best-effort
 * search-engine notification (published posts only, never throwing) attaches
 * here next so it fires from exactly one place.
 */
export async function onPostMutated(mutation: PostMutation): Promise<void> {
  revalidateBlogCache(mutation)
  await notifyIndexNow(mutation)
}

/**
 * Tell search engines the post's public URLs changed — on publish, on edits to a
 * live post, and on takedown (unpublish/delete of a previously-live post). A post
 * that was never public (a plain draft mutation) is invisible to crawlers, so it
 * is never pinged. Best-effort: `pingIndexNow` no-ops without a key and never throws.
 */
async function notifyIndexNow({ slug, previousSlug, isPublished, wasPublished }: PostMutation): Promise<void> {
  if (!isPublished && !wasPublished) return

  const urls = new Set<string>([absoluteUrl('/blog')])
  for (const candidate of [slug, previousSlug]) {
    if (candidate) urls.add(absoluteUrl(`/blog/${candidate}`))
  }
  await pingIndexNow([...urls])
}

function revalidateBlogCache({ type, slug, previousSlug, isPublished }: PostMutation): void {
  revalidatePath('/blog')

  // On create, a draft has no public page yet, so there is nothing to bust —
  // only touch the post page once it is live. On update and delete the page
  // may already be cached (it could have been published before), so always
  // bust the affected slug(s).
  const bustPostPage = type !== 'created' || isPublished
  if (!bustPostPage) return

  const seen = new Set<string>()
  for (const candidate of [slug, previousSlug]) {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate)
      revalidatePath(`/blog/${candidate}`)
    }
  }
}
