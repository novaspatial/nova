import {
  MAX_REPORTS_PER_REQUEST,
  MAX_SAMPLE_LENGTH,
  normalizeCspReports,
} from './cspReport'

const legacy = {
  'csp-report': {
    'document-uri': 'https://nova-spatial.com/portal/new?code=SECRET15',
    'blocked-uri': 'https://evil.example/x.js',
    'violated-directive': 'script-src',
    'effective-directive': 'script-src-elem',
    'source-file': 'https://nova-spatial.com/page?token=abc',
    'line-number': 42,
    'script-sample': 'alert(1)',
    disposition: 'report',
  },
}

describe('normalizeCspReports', () => {
  test('normalizes the legacy report-uri body', () => {
    expect(normalizeCspReports(legacy)).toEqual([
      {
        documentUrl: 'https://nova-spatial.com/portal/new',
        blockedUrl: 'https://evil.example/x.js',
        effectiveDirective: 'script-src-elem',
        disposition: 'report',
        sourceFile: 'https://nova-spatial.com/page',
        lineNumber: 42,
        sample: 'alert(1)',
      },
    ])
  })

  test('strips query strings so discount codes and next targets never reach logs', () => {
    const [report] = normalizeCspReports(legacy)
    expect(report.documentUrl).not.toContain('SECRET15')
    expect(report.sourceFile).not.toContain('token')
  })

  test('normalizes the Reporting-API array shape', () => {
    const reports = normalizeCspReports([
      {
        type: 'csp-violation',
        url: 'https://nova-spatial.com/',
        body: {
          documentURL: 'https://nova-spatial.com/',
          blockedURL: 'https://evil.example/x.js',
          effectiveDirective: 'script-src-elem',
          lineNumber: 7,
          sample: 'alert(1)',
          disposition: 'enforce',
        },
      },
    ])
    expect(reports).toHaveLength(1)
    expect(reports[0].effectiveDirective).toBe('script-src-elem')
  })

  test('drops non-CSP reports that share the endpoint', () => {
    const reports = normalizeCspReports([
      { type: 'deprecation', body: { id: 'x' } },
      { type: 'csp-violation', body: { effectiveDirective: 'img-src' } },
    ])
    expect(reports).toHaveLength(1)
  })

  test.each([
    'chrome-extension://abcdef/inject.js',
    'moz-extension://abcdef/inject.js',
    'about:blank',
  ])('filters browser noise from %s', (blocked) => {
    expect(
      normalizeCspReports({ 'csp-report': { 'blocked-uri': blocked } }),
    ).toEqual([])
  })

  test('caps the number of reports per request', () => {
    const many = Array.from({ length: 25 }, () => ({
      type: 'csp-violation',
      body: { effectiveDirective: 'img-src' },
    }))
    expect(normalizeCspReports(many)).toHaveLength(MAX_REPORTS_PER_REQUEST)
  })

  test('truncates long samples', () => {
    const [report] = normalizeCspReports({
      'csp-report': { 'script-sample': 'x'.repeat(500) },
    })
    expect(report.sample).toHaveLength(MAX_SAMPLE_LENGTH)
  })

  test.each([null, 42, {}, [], 'string'])(
    'returns [] for the garbage payload %s',
    (payload) => {
      expect(normalizeCspReports(payload)).toEqual([])
    },
  )
})
