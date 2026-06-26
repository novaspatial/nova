import { beforeEach, describe, expect, test, vi } from 'vitest'

const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

import { onPostMutated } from './onPostMutated'

function paths() {
  return revalidatePath.mock.calls.map((c) => c[0])
}

describe('onPostMutated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a draft create only revalidates the index — the post page is not live yet', async () => {
    await onPostMutated({ type: 'created', slug: 'hello', isPublished: false })
    expect(paths()).toEqual(['/blog'])
  })

  test('a published create revalidates the index and the post page', async () => {
    await onPostMutated({ type: 'created', slug: 'hello', isPublished: true })
    expect(paths()).toEqual(['/blog', '/blog/hello'])
  })

  test('an update always busts the post page, even when unpublished', async () => {
    await onPostMutated({ type: 'updated', slug: 'hello', isPublished: false })
    expect(paths()).toEqual(['/blog', '/blog/hello'])
  })

  test('an update that renamed the slug busts both the old and new page', async () => {
    await onPostMutated({
      type: 'updated',
      slug: 'new-slug',
      previousSlug: 'old-slug',
      isPublished: true,
    })
    expect(paths()).toEqual(['/blog', '/blog/new-slug', '/blog/old-slug'])
  })

  test('a delete busts the index and the removed post page', async () => {
    await onPostMutated({ type: 'deleted', slug: 'gone', isPublished: false })
    expect(paths()).toEqual(['/blog', '/blog/gone'])
  })

  test('a null slug never produces a /blog/null path', async () => {
    await onPostMutated({ type: 'updated', slug: null, isPublished: true })
    expect(paths()).toEqual(['/blog'])
    expect(paths()).not.toContain('/blog/null')
  })

  test('a slug equal to its previousSlug is only revalidated once', async () => {
    await onPostMutated({
      type: 'updated',
      slug: 'same',
      previousSlug: 'same',
      isPublished: true,
    })
    expect(paths()).toEqual(['/blog', '/blog/same'])
  })
})
