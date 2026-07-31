import { NextResponse, type NextRequest } from 'next/server'
import { normalizeCspReports } from '@/lib/security/cspReport'
import { createCspReportThrottle } from '@/lib/security/cspReportThrottle'

// Deliberately unauthenticated: browsers post CSP violation reports
// without credentials, so none of the requireApi* helpers apply here. The
// endpoint is write-only — it reads and writes no data, so it has no RLS
// surface — and everything it logs is bounded and stripped of query
// strings by normalizeCspReports (#50). Please don't "fix" it by adding
// an auth guard: that would silence the reports it exists to collect.

const MAX_BODY_BYTES = 16 * 1024

// Per-instance and best-effort by design (see the module header): it
// keeps one loud violation — or a flood — from burying the rest of the
// soak evidence. Never observable to the sender; every response path
// below is unchanged.
const throttle = createCspReportThrottle()

const ACCEPTED_CONTENT_TYPES = new Set([
  'application/csp-report',
  'application/reports+json',
  'application/json',
])

export async function POST(request: NextRequest) {
  const contentType = (request.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Report too large' }, { status: 400 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Report too large' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid report body' }, { status: 400 })
  }

  for (const report of normalizeCspReports(payload)) {
    const decision = throttle.admit(report)
    if (decision.action !== 'log') continue
    console.warn(
      '[csp-report]',
      decision.repeatCount > 1
        ? { ...report, repeatCount: decision.repeatCount }
        : report,
    )
  }

  // The reporting spec wants an empty acknowledgement.
  return new NextResponse(null, { status: 204 })
}
