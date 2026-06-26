import { describe, expect, test } from 'vitest'

import robots from './robots'

describe('robots', () => {
  test('allows the site root and disallows the whole non-public surface', () => {
    const rules = robots().rules as {
      userAgent: string
      allow: string
      disallow: string[]
    }
    expect(rules.userAgent).toBe('*')
    expect(rules.allow).toBe('/')
    expect(rules.disallow).toEqual([
      '/api/',
      '/auth/',
      '/login',
      '/profile',
      '/portal/',
      '/blog/admin',
    ])
  })

  test('points at the sitemap on the canonical host', () => {
    const result = robots()
    expect(result.sitemap).toBe('https://nova-spatial.com/sitemap.xml')
    expect(result.host).toBe('https://nova-spatial.com')
  })
})
