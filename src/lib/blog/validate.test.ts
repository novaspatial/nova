import { describe, expect, test } from 'vitest'

import { hasEmptyAltImage, isValidSlug } from './validate'

describe('isValidSlug', () => {
  test.each(['my-post', 'post', 'a1-b2-c3', 'dolby-atmos-101'])(
    'accepts clean slug %s',
    (slug) => {
      expect(isValidSlug(slug)).toBe(true)
    },
  )

  test.each([
    '',
    'Foo Bar',
    'my_post',
    'trailing-',
    '-leading',
    'my--post',
    'café-au-lait',
    'UPPER',
  ])('rejects dirty slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false)
  })
})

describe('hasEmptyAltImage', () => {
  test('flags an image with empty alt text', () => {
    expect(hasEmptyAltImage('![](https://cdn.example/x.jpg)')).toBe(true)
  })

  test('flags an image with whitespace-only alt text', () => {
    expect(hasEmptyAltImage('intro ![   ](https://cdn.example/x.jpg)')).toBe(
      true,
    )
  })

  test('flags when any image among several lacks alt text', () => {
    const body = '![ok](https://cdn.example/a.jpg)\n\n![](https://cdn.example/b.jpg)'
    expect(hasEmptyAltImage(body)).toBe(true)
  })

  test('passes when every image has alt text', () => {
    const body =
      '![Hero](https://cdn.example/a.jpg)\n\n![Diagram](https://cdn.example/b.jpg)'
    expect(hasEmptyAltImage(body)).toBe(false)
  })

  test('passes a body with no images', () => {
    expect(hasEmptyAltImage('## Heading\n\nJust prose.')).toBe(false)
  })
})
