import { beforeEach, describe, expect, test, vi } from 'vitest'

const revalidatePath = vi.fn()
const pingIndexNow = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))
vi.mock('./indexnow', () => ({
  pingIndexNow: (...args: unknown[]) => pingIndexNow(...args),
}))

import { onPostMutated } from './onPostMutated'

function paths() {
  return revalidatePath.mock.calls.map((c) => c[0])
}

/** URLs passed to the single pingIndexNow call, or null if it was never called. */
function pingedUrls(): string[] | null {
  return pingIndexNow.mock.calls.length ? (pingIndexNow.mock.calls[0][0] as string[]) : null
}

describe('onPostMutated — cache revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a draft create only revalidates the index — the post page is not live yet', async () => {
    await onPostMutated({ type: 'created', slug: 'hello', isPublished: false, wasPublished: false })
    expect(paths()).toEqual(['/blog'])
  })

  test('a published create revalidates the index and the post page', async () => {
    await onPostMutated({ type: 'created', slug: 'hello', isPublished: true, wasPublished: false })
    expect(paths()).toEqual(['/blog', '/blog/hello'])
  })

  test('an update always busts the post page, even when unpublished', async () => {
    await onPostMutated({ type: 'updated', slug: 'hello', isPublished: false, wasPublished: true })
    expect(paths()).toEqual(['/blog', '/blog/hello'])
  })

  test('an update that renamed the slug busts both the old and new page', async () => {
    await onPostMutated({
      type: 'updated',
      slug: 'new-slug',
      previousSlug: 'old-slug',
      isPublished: true,
      wasPublished: true,
    })
    expect(paths()).toEqual(['/blog', '/blog/new-slug', '/blog/old-slug'])
  })

  test('a delete busts the index and the removed post page', async () => {
    await onPostMutated({ type: 'deleted', slug: 'gone', isPublished: false, wasPublished: false })
    expect(paths()).toEqual(['/blog', '/blog/gone'])
  })

  test('a null slug never produces a /blog/null path', async () => {
    await onPostMutated({ type: 'updated', slug: null, isPublished: true, wasPublished: true })
    expect(paths()).toEqual(['/blog'])
    expect(paths()).not.toContain('/blog/null')
  })

  test('a slug equal to its previousSlug is only revalidated once', async () => {
    await onPostMutated({
      type: 'updated',
      slug: 'same',
      previousSlug: 'same',
      isPublished: true,
      wasPublished: true,
    })
    expect(paths()).toEqual(['/blog', '/blog/same'])
  })
})

describe('onPostMutated — IndexNow notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('pings on publish (the post became live)', async () => {
    await onPostMutated({ type: 'created', slug: 'hello', isPublished: true, wasPublished: false })
    expect(pingedUrls()).toEqual([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/hello',
    ])
  })

  test('pings on an edit to a live post', async () => {
    await onPostMutated({ type: 'updated', slug: 'hello', isPublished: true, wasPublished: true })
    expect(pingedUrls()).toEqual([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/hello',
    ])
  })

  test('pings on takedown — unpublish of a live post', async () => {
    await onPostMutated({ type: 'updated', slug: 'hello', isPublished: false, wasPublished: true })
    expect(pingedUrls()).toEqual([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/hello',
    ])
  })

  test('pings on delete of a previously-live post', async () => {
    await onPostMutated({ type: 'deleted', slug: 'gone', isPublished: false, wasPublished: true })
    expect(pingedUrls()).toEqual([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/gone',
    ])
  })

  test('pings both URLs on a rename of a live post', async () => {
    await onPostMutated({
      type: 'updated',
      slug: 'new-slug',
      previousSlug: 'old-slug',
      isPublished: true,
      wasPublished: true,
    })
    expect(pingedUrls()).toEqual([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/new-slug',
      'https://nova-spatial.com/blog/old-slug',
    ])
  })

  test('does NOT ping on a draft create', async () => {
    await onPostMutated({ type: 'created', slug: 'draft', isPublished: false, wasPublished: false })
    expect(pingIndexNow).not.toHaveBeenCalled()
  })

  test('does NOT ping on an edit to a still-draft post', async () => {
    await onPostMutated({ type: 'updated', slug: 'draft', isPublished: false, wasPublished: false })
    expect(pingIndexNow).not.toHaveBeenCalled()
  })

  test('does NOT ping on delete of a never-published draft', async () => {
    await onPostMutated({ type: 'deleted', slug: 'draft', isPublished: false, wasPublished: false })
    expect(pingIndexNow).not.toHaveBeenCalled()
  })
})
