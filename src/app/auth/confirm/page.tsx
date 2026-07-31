import { FadeIn } from '@/components/ui/FadeIn'
import { Footer } from '@/components/layout/Footer'
import { GridPattern } from '@/components/ui/GridPattern'
import { Logo } from '@/components/ui/Logo'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CONFIRM_TYPES, isConfirmType } from '@/lib/auth/confirmTypes'
import { safeNextPath } from '@/lib/auth/nextPath'

// Why this page exists: confirmation links are one-shot, and corporate mail
// scanners (Microsoft SafeLinks et al.) GET every link before the human can
// click it, spending the token and stranding the user. Rendering only a
// button here and verifying on its POST keeps the token unspent until a real
// interaction — don't "simplify" this into a page that verifies on load.
// The email templates link here directly with a token_hash (dashboard-owned).

export const metadata: Metadata = {
  title: 'Confirm your email',
  // Middleware only stamps X-Robots-Tag on portal/profile/admin routes, so
  // this page opts out of indexing itself.
  robots: { index: false, follow: false },
}

const COPY = {
  signup: {
    heading: 'Confirm your email',
    sub: 'Click the button below to finish setting up your account.',
    button: 'Confirm my email',
  },
  recovery: {
    heading: 'Reset your password',
    sub: 'Click the button below to continue resetting your password.',
    button: 'Continue password reset',
  },
} as const

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const tokenHash =
    typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = isConfirmType(params.type) ? params.type : null
  const valid = Boolean(tokenHash) && type !== null
  const showRetry = params.error === 'retry'
  const copy = type ? COPY[type] : COPY.signup

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <div className="relative isolate flex flex-1 flex-col">
        <GridPattern
          className="absolute inset-x-0 -top-14 -z-10 h-[1000px] w-full mask-[linear-gradient(to_bottom_left,white_40%,transparent_50%)] fill-violet-500/5 stroke-purple-500/10"
          yOffset={-96}
          interactive
        />
        <div className="flex w-full flex-1 items-center justify-center px-4 py-12">
          <FadeIn className="w-full max-w-lg">
            <div className="mt-12 mb-24 flex justify-center">
              <Link href="/" aria-label="Home">
                <Logo className="h-14" />
              </Link>
            </div>

            <div className="relative rounded-2xl p-px shadow-2xl shadow-violet-500/10">
              <div
                className="absolute inset-0 animate-border-flow rounded-2xl"
                style={{
                  background:
                    'conic-gradient(from var(--border-angle, 0deg), transparent 60%, #a78bfa 78%, #c084fc 82%, #7c3aed 90%, transparent 100%)',
                }}
              />
              <div className="relative rounded-2xl bg-zinc-900 p-8">
                <h1 className="mt-4 text-center text-2xl font-bold text-white">
                  {copy.heading}
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400">
                  {valid
                    ? copy.sub
                    : 'This link is missing the details we need to confirm it.'}
                </p>

                {valid && type ? (
                  <form action="/api/auth/confirm" method="post">
                    {showRetry && (
                      <div className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                        We couldn&apos;t reach the authentication service.
                        Please try again in a moment.
                      </div>
                    )}
                    <input type="hidden" name="token_hash" value={tokenHash} />
                    <input type="hidden" name="type" value={type} />
                    {/* Sanitized again server-side — hidden fields are editable. */}
                    <input
                      type="hidden"
                      name="next"
                      value={safeNextPath(params.next, CONFIRM_TYPES[type])}
                    />
                    <button
                      type="submit"
                      className="mx-auto mt-10 block w-1/2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                    >
                      {copy.button}
                    </button>
                  </form>
                ) : (
                  <div className="mt-8 space-y-4">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                      This confirmation link is invalid. Open the most recent
                      email we sent you, or request a new one from the sign-in
                      page.
                    </div>
                    <div className="text-center text-sm text-zinc-400">
                      <Link
                        href="/login"
                        className="font-medium text-violet-400 transition hover:text-violet-300"
                      >
                        Back to sign in
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
        <Footer />
      </div>
    </div>
  )
}
