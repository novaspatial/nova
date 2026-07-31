import type { NextRequest } from 'next/server'
import { POST } from './route'

function reportRequest(
  body: unknown,
  { contentType = 'application/csp-report', contentLength }: {
    contentType?: string
    contentLength?: string
  } = {},
) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': contentType }
  if (contentLength) headers['content-length'] = contentLength
  return new Request('https://nova-spatial.com/api/csp-report', {
    method: 'POST',
    headers,
    body: payload,
  }) as unknown as NextRequest
}

const violation = {
  'csp-report': {
    'document-uri': 'https://nova-spatial.com/',
    'blocked-uri': 'https://evil.example/x.js',
    'effective-directive': 'script-src-elem',
  },
}

describe('POST /api/csp-report', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  test('logs a violation and acknowledges with 204', async () => {
    const res = await POST(reportRequest(violation))
    expect(res.status).toBe(204)
    expect(warn).toHaveBeenCalledWith('[csp-report]', expect.any(Object))
  })

  test('accepts the Reporting-API content type', async () => {
    const res = await POST(
      reportRequest(
        [{ type: 'csp-violation', body: { effectiveDirective: 'img-src' } }],
        { contentType: 'application/reports+json' },
      ),
    )
    expect(res.status).toBe(204)
  })

  test('stays quiet for extension noise', async () => {
    const res = await POST(
      reportRequest({
        'csp-report': { 'blocked-uri': 'chrome-extension://abc/inject.js' },
      }),
    )
    expect(res.status).toBe(204)
    expect(warn).not.toHaveBeenCalled()
  })

  test('rejects a wrong content type', async () => {
    const res = await POST(
      reportRequest(violation, { contentType: 'text/plain' }),
    )
    expect(res.status).toBe(400)
  })

  test('rejects an unparseable body', async () => {
    const res = await POST(reportRequest('{not json'))
    expect(res.status).toBe(400)
  })

  test('rejects an oversized declared length', async () => {
    const res = await POST(
      reportRequest(violation, { contentLength: '20000' }),
    )
    expect(res.status).toBe(400)
  })

  test('rejects an oversized body even when the length header lies', async () => {
    const res = await POST(
      reportRequest({ 'csp-report': { 'script-sample': 'x'.repeat(20000) } }),
    )
    expect(res.status).toBe(400)
  })

  test('works with no credentials — the endpoint is public by protocol necessity', async () => {
    const res = await POST(reportRequest(violation))
    expect(res.status).toBe(204)
  })

  // The throttle is a module-level singleton shared across this file, so
  // each case below uses its own blocked-uri.
  describe('log throttling', () => {
    function violationFor(blocked: string) {
      return {
        'csp-report': {
          'document-uri': 'https://nova-spatial.com/',
          'blocked-uri': blocked,
          'effective-directive': 'script-src-elem',
        },
      }
    }

    test('a repeated violation logs once, and every response stays 204', async () => {
      const body = violationFor('https://repeat.example/a.js')

      for (let i = 0; i < 4; i++) {
        const res = await POST(reportRequest(body))
        expect(res.status).toBe(204)
      }
      // Suppression is invisible to the sender — only the log is bounded.
      expect(warn).toHaveBeenCalledTimes(1)
    })

    test('distinct violations each get their own line', async () => {
      await POST(reportRequest(violationFor('https://distinct.example/a.js')))
      await POST(reportRequest(violationFor('https://distinct.example/b.js')))
      expect(warn).toHaveBeenCalledTimes(2)
    })
  })
})
