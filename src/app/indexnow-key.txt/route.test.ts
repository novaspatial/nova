import { afterEach, describe, expect, test } from 'vitest'

import { GET } from './route'

const ORIGINAL_KEY = process.env.INDEXNOW_KEY

describe('GET /indexnow-key.txt', () => {
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.INDEXNOW_KEY
    else process.env.INDEXNOW_KEY = ORIGINAL_KEY
  })

  test('returns the key as text/plain when configured', async () => {
    process.env.INDEXNOW_KEY = 'abc123def456'
    const res = GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain')
    expect(await res.text()).toBe('abc123def456')
  })

  test('returns 404 when no key is configured', async () => {
    delete process.env.INDEXNOW_KEY
    const res = GET()
    expect(res.status).toBe(404)
  })
})
