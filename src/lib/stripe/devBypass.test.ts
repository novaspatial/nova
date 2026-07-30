import { isPaymentsDevBypassEnabled } from './devBypass'

describe('isPaymentsDevBypassEnabled', () => {
  test('off when the flag is unset', () => {
    expect(isPaymentsDevBypassEnabled({})).toBe(false)
  })

  test('off for any value other than the exact string true', () => {
    expect(isPaymentsDevBypassEnabled({ PAYMENTS_DEV_BYPASS: '1' })).toBe(false)
    expect(isPaymentsDevBypassEnabled({ PAYMENTS_DEV_BYPASS: 'TRUE' })).toBe(
      false,
    )
  })

  test('on in local dev and test envs', () => {
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        NODE_ENV: 'test',
      }),
    ).toBe(true)
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        NODE_ENV: 'development',
      }),
    ).toBe(true)
  })

  test('forced off on Vercel production even with the flag set', () => {
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  test('forced off under bare NODE_ENV=production (non-Vercel hosting)', () => {
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  test('stays usable on Vercel preview, where NODE_ENV is also production', () => {
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      }),
    ).toBe(true)
  })
})
