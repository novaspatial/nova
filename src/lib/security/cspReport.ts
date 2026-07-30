// Normalization for the CSP violation sink (#50). Browsers post two
// different shapes — the legacy `report-uri` body and the Reporting-API
// array — and a public endpoint gets a lot of noise, so both are folded
// into one bounded, log-safe record here.

export const MAX_REPORTS_PER_REQUEST = 10
export const MAX_FIELD_LENGTH = 300
export const MAX_SAMPLE_LENGTH = 120

export type NormalizedCspReport = {
  documentUrl: string | null
  blockedUrl: string | null
  effectiveDirective: string | null
  disposition: string | null
  sourceFile: string | null
  lineNumber: number | null
  sample: string | null
}

// Extension-injected scripts are the dominant source of violations on any
// public site and say nothing about our policy.
const NOISE_SCHEMES =
  /^(?:(?:chrome|chrome-untrusted|moz|safari|safari-web|ms-browser)-extension|webkit-masked-url|resource|about|chrome):/i

function str(value: unknown, max = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== 'string' || value === '') return null
  return value.slice(0, max)
}

// URLs can carry secrets — a discount `?code=`, a `?next=` target. Only
// the path is ever useful in a violation report.
function cleanUrl(value: unknown): string | null {
  const raw = str(value)
  return raw ? raw.split(/[?#]/)[0] : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function fromLegacy(payload: Record<string, unknown>): NormalizedCspReport {
  return {
    documentUrl: cleanUrl(payload['document-uri']),
    blockedUrl: cleanUrl(payload['blocked-uri']),
    effectiveDirective: str(
      payload['effective-directive'] ?? payload['violated-directive'],
    ),
    disposition: str(payload['disposition']),
    sourceFile: cleanUrl(payload['source-file']),
    lineNumber: num(payload['line-number']),
    sample: str(payload['script-sample'], MAX_SAMPLE_LENGTH),
  }
}

function fromReportingApi(body: Record<string, unknown>): NormalizedCspReport {
  return {
    documentUrl: cleanUrl(body.documentURL),
    blockedUrl: cleanUrl(body.blockedURL),
    effectiveDirective: str(body.effectiveDirective),
    disposition: str(body.disposition),
    sourceFile: cleanUrl(body.sourceFile),
    lineNumber: num(body.lineNumber),
    sample: str(body.sample, MAX_SAMPLE_LENGTH),
  }
}

function isNoise(report: NormalizedCspReport): boolean {
  return Boolean(report.blockedUrl && NOISE_SCHEMES.test(report.blockedUrl))
}

export function normalizeCspReports(payload: unknown): NormalizedCspReport[] {
  const reports: NormalizedCspReport[] = []

  if (Array.isArray(payload)) {
    for (const entry of payload.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as Record<string, unknown>
      // The endpoint also receives deprecation/intervention reports.
      if (record.type !== 'csp-violation') continue
      if (typeof record.body !== 'object' || record.body === null) continue
      reports.push(fromReportingApi(record.body as Record<string, unknown>))
    }
  } else if (typeof payload === 'object' && payload !== null) {
    const legacy = (payload as Record<string, unknown>)['csp-report']
    if (typeof legacy === 'object' && legacy !== null) {
      reports.push(fromLegacy(legacy as Record<string, unknown>))
    }
  }

  return reports.filter((report) => !isNoise(report))
}
