import { metadata as aboutMetadata } from './about/page'
import { metadata as blogMetadata } from './blog/page'
import { metadata as contactMetadata } from './contact/page'
import { metadata as termsMetadata } from './terms/page'

// The root canonical ('/' in layout.tsx) is inherited by every route that
// does not override it, which is how these four ended up declaring
// themselves duplicates of the homepage (#53). The layout itself is not
// imported here — next/font/local does not load under vitest.
describe('page canonicals', () => {
  test.each([
    ['/about', aboutMetadata],
    ['/contact', contactMetadata],
    ['/terms', termsMetadata],
    ['/blog', blogMetadata],
  ])('%s is self-referential', (path, meta) => {
    expect(meta.alternates?.canonical).toBe(path)
  })
})
