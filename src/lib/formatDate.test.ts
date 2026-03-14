import { describe, expect, test } from 'vitest'

import { formatDate } from './formatDate'

describe('formatDate', () => {
  test('formats full dates with a day', () => {
    expect(formatDate('2026-03-13')).toBe('March 13, 2026')
  })

  test('formats year-month values without adding a day', () => {
    expect(formatDate('2026-03')).toBe('March 2026')
  })
})
