import { isPaymentsDevBypassEnabled } from './devBypass'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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

  // The preview scope is #45's live failure path: one Supabase project, no
  // branches, so preview writes to the production database.
  test('forced off on Vercel preview, which talks to the production database', () => {
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      }),
    ).toBe(false)
  })

  test('forced off on Vercel regardless of scope or NODE_ENV', () => {
    // VERCEL alone, no VERCEL_ENV — a deploy target we do not enumerate.
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        VERCEL: '1',
        NODE_ENV: 'development',
      }),
    ).toBe(false)
    // An unrecognised VERCEL_ENV value must not fall through to "allowed".
    expect(
      isPaymentsDevBypassEnabled({
        PAYMENTS_DEV_BYPASS: 'true',
        VERCEL_ENV: 'development',
        NODE_ENV: 'development',
      }),
    ).toBe(false)
  })
})

// The guard is only as good as its single reader (#45): a future refactor
// reading process.env.PAYMENTS_DEV_BYPASS somewhere else would bypass it
// silently, and a .env.example that ships the flag armed is how a bulk
// env import arms production in the first place. Neither is expressible
// as a unit test of the helper, so they are asserted against the tree.
describe('the dev-bypass env surface', () => {
  const repoRoot = path.resolve(__dirname, '../../..')

  test('devBypass.ts is the only place in src/ that names the flag', () => {
    const hits = execSync(
      `grep -rl "PAYMENTS_DEV_BYPASS" ${repoRoot}/src || true`,
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
      .map((file) => path.relative(repoRoot, file))
      // Tests set the variable to exercise both branches; that is the point.
      .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))

    expect(hits).toEqual(['src/lib/stripe/devBypass.ts'])
  })

  test('.env.example never ships the flag armed', () => {
    const example = readFileSync(path.join(repoRoot, '.env.example'), 'utf8')
    const armed = example
      .split('\n')
      .filter((line) => /^\s*PAYMENTS_DEV_BYPASS\s*=/.test(line))

    expect(armed).toEqual([])
  })
})
