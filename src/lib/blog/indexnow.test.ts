import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { pingIndexNow } from './indexnow'

const ORIGINAL_KEY = process.env.INDEXNOW_KEY

function restoreKey() {
  if (ORIGINAL_KEY === undefined) delete process.env.INDEXNOW_KEY
  else process.env.INDEXNOW_KEY = ORIGINAL_KEY
}

describe('pingIndexNow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    restoreKey()
    vi.unstubAllGlobals()
  })

  test('no-ops (no fetch) when INDEXNOW_KEY is unset', async () => {
    delete process.env.INDEXNOW_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await pingIndexNow(['https://nova-spatial.com/blog/x'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('no-ops (no fetch) when there are no URLs', async () => {
    process.env.INDEXNOW_KEY = 'testkey123'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await pingIndexNow([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('POSTs the IndexNow payload with host, key, keyLocation and urlList', async () => {
    process.env.INDEXNOW_KEY = 'testkey123'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await pingIndexNow([
      'https://nova-spatial.com/blog',
      'https://nova-spatial.com/blog/hello',
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.indexnow.org/indexnow')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      host: 'nova-spatial.com',
      key: 'testkey123',
      keyLocation: 'https://nova-spatial.com/indexnow-key.txt',
      urlList: [
        'https://nova-spatial.com/blog',
        'https://nova-spatial.com/blog/hello',
      ],
    })
  })

  test('logs but does not throw when the endpoint rejects the ping', async () => {
    process.env.INDEXNOW_KEY = 'testkey123'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      pingIndexNow(['https://nova-spatial.com/blog/x']),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })

  test('logs but does not throw when fetch itself fails', async () => {
    process.env.INDEXNOW_KEY = 'testkey123'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      pingIndexNow(['https://nova-spatial.com/blog/x']),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })
})
