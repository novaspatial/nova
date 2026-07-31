import { createCspReportThrottle } from './cspReportThrottle'
import type { NormalizedCspReport } from './cspReport'

function report(
  overrides: Partial<NormalizedCspReport> = {},
): NormalizedCspReport {
  return {
    documentUrl: '/portal',
    blockedUrl: 'https://evil.example/x.js',
    effectiveDirective: 'script-src',
    disposition: 'report',
    sourceFile: null,
    lineNumber: null,
    sample: null,
    ...overrides,
  }
}

/** A clock the test advances by hand. */
function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('createCspReportThrottle', () => {
  test('logs a first sighting with no repeat count', () => {
    const throttle = createCspReportThrottle({ now: clock().now })
    expect(throttle.admit(report())).toEqual({ action: 'log', repeatCount: 1 })
  })

  test('suppresses repeats of the same violation inside the window', () => {
    const throttle = createCspReportThrottle({ now: clock().now })
    throttle.admit(report())
    expect(throttle.admit(report())).toEqual({ action: 'suppress' })
    expect(throttle.admit(report())).toEqual({ action: 'suppress' })
  })

  test('logs once with the accumulated count after the window closes', () => {
    const c = clock()
    const throttle = createCspReportThrottle({
      dedupeWindowMs: 60_000,
      now: c.now,
    })

    throttle.admit(report())
    throttle.admit(report())
    throttle.admit(report())
    c.advance(60_001)

    // The line that reopens the window carries the three suppressed ones
    // plus itself.
    expect(throttle.admit(report())).toEqual({ action: 'log', repeatCount: 3 })
    // ...and the counter resets with the new window.
    c.advance(60_001)
    expect(throttle.admit(report())).toEqual({ action: 'log', repeatCount: 1 })
  })

  test('keys on directive and blocked URL together, so distinct violations both log', () => {
    const throttle = createCspReportThrottle({ now: clock().now })

    expect(throttle.admit(report()).action).toBe('log')
    expect(
      throttle.admit(report({ effectiveDirective: 'connect-src' })).action,
    ).toBe('log')
    expect(
      throttle.admit(report({ blockedUrl: 'https://other.example/y.js' }))
        .action,
    ).toBe('log')
  })

  test('a flood of distinct violations exhausts the bucket, then suppresses', () => {
    const throttle = createCspReportThrottle({
      capacity: 3,
      refillPerMinute: 1,
      now: clock().now,
    })

    for (let i = 0; i < 3; i++) {
      expect(
        throttle.admit(report({ blockedUrl: `https://evil.example/${i}.js` }))
          .action,
      ).toBe('log')
    }
    expect(
      throttle.admit(report({ blockedUrl: 'https://evil.example/4.js' })).action,
    ).toBe('suppress')
  })

  test('the bucket refills over time', () => {
    const c = clock()
    const throttle = createCspReportThrottle({
      capacity: 2,
      refillPerMinute: 1,
      now: c.now,
    })

    throttle.admit(report({ blockedUrl: 'a' }))
    throttle.admit(report({ blockedUrl: 'b' }))
    expect(throttle.admit(report({ blockedUrl: 'c' })).action).toBe('suppress')

    c.advance(60_000)
    expect(throttle.admit(report({ blockedUrl: 'd' })).action).toBe('log')
  })

  test('refill never exceeds capacity', () => {
    const c = clock()
    const throttle = createCspReportThrottle({
      capacity: 2,
      refillPerMinute: 60,
      now: c.now,
    })

    c.advance(60 * 60_000)
    expect(throttle.admit(report({ blockedUrl: 'a' })).action).toBe('log')
    expect(throttle.admit(report({ blockedUrl: 'b' })).action).toBe('log')
    expect(throttle.admit(report({ blockedUrl: 'c' })).action).toBe('suppress')
  })

  test('a suppressed report still counts toward its window', () => {
    const c = clock()
    const throttle = createCspReportThrottle({
      capacity: 1,
      refillPerMinute: 1,
      dedupeWindowMs: 60_000,
      now: c.now,
    })

    // Spend the only token on a different violation, so the one under
    // test is refused for budget rather than dedupe.
    throttle.admit(report({ blockedUrl: 'other' }))
    expect(throttle.admit(report()).action).toBe('suppress')
    expect(throttle.admit(report()).action).toBe('suppress')

    c.advance(120_000)
    // Both suppressed arrivals are accounted for in the eventual line.
    expect(throttle.admit(report())).toEqual({ action: 'log', repeatCount: 3 })
  })

  test('evicts the oldest windows past the key cap', () => {
    const c = clock()
    const throttle = createCspReportThrottle({
      capacity: 1000,
      maxKeys: 2,
      dedupeWindowMs: 10 * 60_000,
      now: c.now,
    })

    throttle.admit(report({ blockedUrl: 'a' }))
    c.advance(1_000)
    throttle.admit(report({ blockedUrl: 'b' }))
    c.advance(1_000)
    throttle.admit(report({ blockedUrl: 'c' }))

    // 'a' was evicted, so it reads as a first sighting again; 'c' is
    // still inside its window.
    expect(throttle.admit(report({ blockedUrl: 'a' })).action).toBe('log')
    expect(throttle.admit(report({ blockedUrl: 'c' })).action).toBe('suppress')
  })
})
