'use client'

import { FadeIn } from '@/components/ui/FadeIn'
import { Footer } from '@/components/layout/Footer'
import { GridPattern } from '@/components/ui/GridPattern'
import { Logo } from '@/components/ui/Logo'
import {
  WELCOME_DISCOUNT_PCT,
  WELCOME_PROMO_TOKEN,
} from '@/lib/stripe/pricing'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { safeNextPath } from '@/lib/auth/nextPath'

type AuthMode = 'login' | 'signup' | 'reset'

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError')
    ) {
      return 'Unable to reach the authentication service. Please try again in a moment.'
    }
    return error.message
  }

  return 'Something went wrong while contacting the authentication service.'
}

async function submitAuthRequest(
  path:
    | '/api/auth/login'
    | '/api/auth/signup'
    | '/api/auth/reset-password'
    | '/api/auth/resend-confirmation',
  body: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const result = (await response.json()) as { error?: string }

  if (!response.ok) {
    return { error: result.error || 'Authentication failed.' }
  }

  return { error: null }
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const defaultMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const defaultEmail = searchParams.get('email') || ''
  const hasPromo = searchParams.get('promo') === WELCOME_PROMO_TOKEN
  // router.push hands a protocol-relative href to window.location, so an
  // unsanitized ?next= leaves the origin from here (#56).
  const nextPath = safeNextPath(searchParams.get('next'), '/portal')

  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [signupEmailSent, setSignupEmailSent] = useState(false)
  const [resendState, setResendState] = useState<
    'idle' | 'sending' | 'cooldown'
  >('idle')

  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit =
    !loading && (mode !== 'signup' || (passwordsMatch && password.length >= 6))

  // Update state if URL parameters change after initial render
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setMode('signup')
    const urlEmail = searchParams.get('email')
    if (urlEmail) setEmail(urlEmail)

    // Errors handed over by /auth/callback and /api/auth/confirm. A used or
    // expired confirmation link usually means the account IS confirmed (a
    // mail scanner spent the one-shot token), so that one reads as guidance,
    // not failure. Unknown codes render nothing.
    const urlError = searchParams.get('error')
    if (urlError === 'confirm-link-used') {
      setMessage(
        "That confirmation link was already used. If you've confirmed your email, just sign in below.",
      )
      // Both messages below promise a way to get a new link — arm the
      // resend control so that promise is actually reachable, not just
      // available to someone who happens to still be mid-signup.
      setSignupEmailSent(true)
    } else if (urlError === 'auth-code-error') {
      setError(
        "That sign-in link didn't work — it may have expired. Sign in below, or request a new link.",
      )
      setSignupEmailSent(true)
    } else if (urlError === 'recovery-link-used') {
      // Password-reset links fail differently: the account usually isn't
      // confirmed-and-forgotten, the user still can't sign in without a
      // password. Send them straight to the form that gets them a new link.
      setMode('reset')
      setMessage(
        "That password reset link was already used or has expired. Enter your email below to get a new one.",
      )
    }
  }, [searchParams])


  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'login') {
        const { error } = await submitAuthRequest('/api/auth/login', {
          email,
          password,
        })
        if (error) {
          setError(error)
        } else {
          router.push(nextPath)
          router.refresh()
        }
      } else if (mode === 'signup') {
        const { error } = await submitAuthRequest('/api/auth/signup', {
          email,
          password,
          promoCode: hasPromo ? WELCOME_PROMO_TOKEN : null,
          next: nextPath,
        })
        if (error) {
          setError(error)
        } else {
          setMessage('Check your email for a confirmation link.')
          setSignupEmailSent(true)
        }
      } else {
        const { error } = await submitAuthRequest('/api/auth/reset-password', {
          email,
        })
        if (error) {
          setError(error)
        } else {
          setMessage(
            "If an account exists for that email, we've sent a reset link.",
          )
        }
      }
    } catch (error) {
      setError(getAuthErrorMessage(error))
    }

    setLoading(false)
  }

  async function handleResend() {
    setResendState('sending')
    setError(null)

    try {
      const { error } = await submitAuthRequest('/api/auth/resend-confirmation', {
        email,
        next: nextPath,
      })
      if (error) {
        // A real failure (network/misconfig) — GoTrue's own cooldown never
        // reaches here, since the route swallows it for existence obfuscation.
        setError(error)
        setResendState('idle')
      } else {
        setMessage("We've sent another confirmation email — check your inbox.")
        // GoTrue's resend window is 60s; a timer firing after a mode switch
        // only re-enables a button that is no longer rendered.
        setResendState('cooldown')
        window.setTimeout(() => setResendState('idle'), 60_000)
      }
    } catch (error) {
      setError(getAuthErrorMessage(error))
      setResendState('idle')
    }
  }

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
                  {mode === 'login'
                    ? 'Welcome back'
                    : mode === 'signup'
                      ? 'Create your account'
                      : 'Reset your password'}
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400">
                  {mode === 'login'
                    ? 'Sign in to your account'
                    : mode === 'signup'
                      ? 'Get started with NovaSpatial'
                      : "Enter your email and we'll send you a reset link"}
                </p>

                {hasPromo && mode === 'signup' && (
                  <div className="mx-auto mt-6 flex max-w-fit items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
                    ✨ {WELCOME_DISCOUNT_PCT}% Welcome Offer
                  </div>
                )}

                {/* TODO: Enable Google and Apple social login once provider credentials are configured */}

                <form onSubmit={handleEmailAuth} className="mt-8 space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-zinc-300"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                      placeholder="you@example.com"
                    />
                  </div>

                  {mode !== 'reset' && (
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-zinc-300"
                      >
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        placeholder="••••••••"
                      />
                      {mode === 'login' && (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setMode('reset')
                              setConfirmPassword('')
                              setError(null)
                              setMessage(null)
                              setSignupEmailSent(false)
                              setResendState('idle')
                            }}
                            className="text-xs font-medium text-violet-400 transition hover:text-violet-300"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === 'signup' && (
                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block text-sm font-medium text-zinc-300"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        placeholder="••••••••"
                      />
                      {confirmPassword.length > 0 && (
                        <p
                          className={`mt-2 flex items-center gap-1.5 text-xs ${
                            passwordsMatch
                              ? 'text-emerald-400'
                              : 'text-zinc-500'
                          }`}
                        >
                          {passwordsMatch ? (
                            <>
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 5.296a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414L8.5 12.086l6.79-6.79a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Passwords match
                            </>
                          ) : (
                            'Passwords do not match'
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
                      {message}
                    </div>
                  )}

                  {signupEmailSent && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendState !== 'idle' || !email}
                        className="mx-auto block text-sm font-medium text-violet-400 transition hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resendState === 'sending'
                          ? 'Sending...'
                          : resendState === 'cooldown'
                            ? 'Confirmation email sent'
                            : "Didn't get it? Resend confirmation email"}
                      </button>
                      {resendState === 'idle' && !email && (
                        <p className="mt-1 text-xs text-zinc-500">
                          Enter your email above first.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="mx-auto mt-10 block w-1/2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? 'Loading...'
                      : mode === 'login'
                        ? 'Sign in'
                        : mode === 'signup'
                          ? 'Create account'
                          : 'Send reset link'}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-zinc-400">
                  {mode === 'login' ? (
                    <>
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup')
                          setConfirmPassword('')
                          setError(null)
                          setMessage(null)
                          setSignupEmailSent(false)
                          setResendState('idle')
                        }}
                        className="font-medium text-violet-400 transition hover:text-violet-300"
                      >
                        Sign up
                      </button>
                    </>
                  ) : mode === 'signup' ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login')
                          setConfirmPassword('')
                          setError(null)
                          setMessage(null)
                          setSignupEmailSent(false)
                          setResendState('idle')
                        }}
                        className="font-medium text-violet-400 transition hover:text-violet-300"
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login')
                        setConfirmPassword('')
                        setError(null)
                        setMessage(null)
                        setSignupEmailSent(false)
                        setResendState('idle')
                      }}
                      className="font-medium text-violet-400 transition hover:text-violet-300"
                    >
                      Back to sign in
                    </button>
                  )}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
        <Footer />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
