import * as Sentry from '@sentry/nextjs'
import {
  alertMoneyPathAnomaly,
  isErrorReportingConfigured,
  reportError,
} from './report'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

const captureException = vi.mocked(Sentry.captureException)
const captureMessage = vi.mocked(Sentry.captureMessage)

describe('reportError', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => consoleError.mockRestore())

  test('captures the error with its context and still logs', () => {
    const error = new Error('boom')
    reportError(error, { digest: 'abc123' })

    expect(captureException).toHaveBeenCalledWith(error, {
      extra: { digest: 'abc123' },
    })
    expect(consoleError).toHaveBeenCalled()
  })

  test('a failure inside the reporter never propagates', () => {
    // Reporting must not become the error the user sees.
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry down')
    })
    expect(() => reportError(new Error('boom'))).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('alertMoneyPathAnomaly', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => consoleError.mockRestore())

  test('captures at error level, fingerprinted per kind', () => {
    alertMoneyPathAnomaly({
      kind: 'webhook_user_id_mismatch',
      intentId: 'pi_1',
      projectId: 'proj-1',
      expected: 'user-1',
      actual: 'user-2',
    })

    expect(captureMessage).toHaveBeenCalledWith(
      'Money-path anomaly: webhook_user_id_mismatch',
      expect.objectContaining({
        level: 'error',
        fingerprint: ['money-path', 'webhook_user_id_mismatch'],
        extra: expect.objectContaining({
          intentId: 'pi_1',
          projectId: 'proj-1',
          expected: 'user-1',
          actual: 'user-2',
        }),
      }),
    )
  })

  test('carries identifiers only — never amounts, emails, or card data', () => {
    alertMoneyPathAnomaly({
      kind: 'payment_status_add_ons_mismatch',
      intentId: 'pi_1',
      projectId: 'proj-1',
    })

    const extra = captureMessage.mock.calls[0][1]?.extra ?? {}
    expect(Object.keys(extra).sort()).toEqual([
      'actual',
      'expected',
      'intentId',
      'projectId',
    ])
  })

  test('still logs when the transport throws, and never propagates', () => {
    captureMessage.mockImplementationOnce(() => {
      throw new Error('sentry down')
    })
    expect(() =>
      alertMoneyPathAnomaly({
        kind: 'webhook_project_id_mismatch',
        intentId: 'pi_1',
        projectId: 'proj-1',
      }),
    ).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
  })
})

describe('isErrorReportingConfigured', () => {
  test.each([
    ['a DSN is set', { NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' }, true],
    ['no DSN is set', {}, false],
    ['the DSN is empty', { NEXT_PUBLIC_SENTRY_DSN: '' }, false],
  ])('is %s -> %s', (_label, env, expected) => {
    expect(isErrorReportingConfigured(env as NodeJS.ProcessEnv)).toBe(expected)
  })
})
