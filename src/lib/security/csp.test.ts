import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  resolveCspMode,
  supabaseAssetHost,
} from './csp'

const prodEnv = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SITE_URL: 'https://nova-spatial.com',
} as NodeJS.ProcessEnv

describe('buildContentSecurityPolicy', () => {
  test('allows every host Stripe.js actually contacts', () => {
    const policy = buildContentSecurityPolicy(prodEnv)
    expect(policy).toContain('https://js.stripe.com')
    // Report-Only was masking these three; enforcing without them would
    // break the payment step (#50).
    expect(policy).toContain('https://m.stripe.network')
    expect(policy).toContain('https://r.stripe.com')
    expect(policy).toContain('https://m.stripe.com')
  })

  test('drops unsafe-eval in production and keeps it in dev', () => {
    expect(buildContentSecurityPolicy(prodEnv)).not.toContain("'unsafe-eval'")
    const dev = buildContentSecurityPolicy({
      ...prodEnv,
      NODE_ENV: 'development',
    } as NodeJS.ProcessEnv)
    expect(dev).toContain("'unsafe-eval'")
    expect(dev).toContain('ws://localhost:*')
    expect(dev).toContain('https://va.vercel-scripts.com')
  })

  test('wires the Supabase origin and websocket into the right directives', () => {
    const policy = buildContentSecurityPolicy(prodEnv)
    expect(policy).toContain('https://project.supabase.co')
    expect(policy).toContain('wss://project.supabase.co')
  })

  test('names the report endpoint in both mechanisms', () => {
    const policy = buildContentSecurityPolicy(prodEnv)
    expect(policy).toContain('report-uri /api/csp-report')
    expect(policy).toContain('report-to csp-endpoint')
  })

  test('keeps the hardening directives', () => {
    const policy = buildContentSecurityPolicy(prodEnv)
    for (const directive of [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(policy).toContain(directive)
    }
  })

  test('drops report-to (and its header) when no canonical origin is configured', () => {
    const env = { ...prodEnv, NEXT_PUBLIC_SITE_URL: undefined } as NodeJS.ProcessEnv
    const policy = buildContentSecurityPolicy(env)
    // A relative Reporting-Endpoints URL is ignored by browsers, so the
    // pair is omitted rather than emitted broken; report-uri still works.
    expect(policy).not.toContain('report-to')
    expect(policy).toContain('report-uri /api/csp-report')
    expect(buildSecurityHeaders(env).map((h) => h.key)).not.toContain(
      'Reporting-Endpoints',
    )
  })

  test.each([undefined, 'not-a-url'])(
    'degrades cleanly when NEXT_PUBLIC_SUPABASE_URL is %s',
    (url) => {
      const policy = buildContentSecurityPolicy({
        ...prodEnv,
        NEXT_PUBLIC_SUPABASE_URL: url,
      } as NodeJS.ProcessEnv)
      expect(policy).not.toContain('undefined')
      expect(policy).not.toMatch(/\s{2,}/)
      expect(policy).not.toMatch(/;\s*;/)
      expect(policy).not.toMatch(/(?:^|\s)(https|wss):\/\/(?:\s|;|$)/)
    },
  )
})

describe('resolveCspMode', () => {
  test('only the exact string enforce enforces', () => {
    expect(resolveCspMode('enforce')).toBe('enforce')
    expect(resolveCspMode('report-only')).toBe('report-only')
    expect(resolveCspMode(undefined)).toBe('report-only')
    expect(resolveCspMode('ENFORCE')).toBe('report-only')
  })
})

describe('buildSecurityHeaders', () => {
  test('uses the report-only header key by default and the enforcing key when asked', () => {
    const keysFor = (env: NodeJS.ProcessEnv) =>
      buildSecurityHeaders(env).map((header) => header.key)

    expect(keysFor(prodEnv)).toContain('Content-Security-Policy-Report-Only')
    expect(keysFor({ ...prodEnv, CSP_MODE: 'enforce' })).toContain(
      'Content-Security-Policy',
    )
  })

  test('the policy value is identical in both modes', () => {
    const value = (env: NodeJS.ProcessEnv) =>
      buildSecurityHeaders(env).find((h) => h.key.startsWith('Content-Security'))
        ?.value
    expect(value({ ...prodEnv, CSP_MODE: 'enforce' })).toBe(value(prodEnv))
  })

  test('keeps the pre-existing hardening headers and adds the reporting endpoint', () => {
    const headers = Object.fromEntries(
      buildSecurityHeaders(prodEnv).map((h) => [h.key, h.value]),
    )
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    )
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    )
    expect(headers['Reporting-Endpoints']).toBe(
      'csp-endpoint="https://nova-spatial.com/api/csp-report"',
    )
  })
})

describe('supabaseAssetHost', () => {
  test('extracts the hostname and returns null for anything unusable', () => {
    expect(supabaseAssetHost('https://project.supabase.co')).toBe(
      'project.supabase.co',
    )
    expect(supabaseAssetHost('not-a-url')).toBeNull()
    expect(supabaseAssetHost(undefined)).toBeNull()
  })
})
