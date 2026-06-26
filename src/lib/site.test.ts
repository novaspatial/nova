import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('site config', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = original
  })

  test('defaults to the bare production domain when the env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const { SITE_URL } = await import('./site')
    expect(SITE_URL).toBe('https://nova-spatial.com')
  })

  test('reads NEXT_PUBLIC_SITE_URL and strips any trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.nova-spatial.com/'
    const { SITE_URL } = await import('./site')
    expect(SITE_URL).toBe('https://staging.nova-spatial.com')
  })

  test('absoluteUrl joins a root-relative path onto the canonical host', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const { absoluteUrl } = await import('./site')
    expect(absoluteUrl('/blog/my-post')).toBe('https://nova-spatial.com/blog/my-post')
    expect(absoluteUrl()).toBe('https://nova-spatial.com/')
  })
})
