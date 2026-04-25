import { describe, expect, test } from 'vitest'

import { slugify } from './slug'

describe('slugify', () => {
  test('lowercases and dashes spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  test('strips punctuation and collapses runs of separators', () => {
    expect(slugify("It's a test! — Really?")).toBe('it-s-a-test-really')
  })

  test('strips diacritics', () => {
    expect(slugify('Café Société')).toBe('cafe-societe')
  })

  test('drops leading and trailing dashes', () => {
    expect(slugify('  --weird-- ')).toBe('weird')
  })

  test('clamps length to 80 chars', () => {
    const long = 'word '.repeat(40)
    expect(slugify(long).length).toBeLessThanOrEqual(80)
  })
})
