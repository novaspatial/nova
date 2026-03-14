'use client'

import { FadeIn } from '@/components/ui/FadeIn'
import { Footer } from '@/components/layout/Footer'
import { GridPattern } from '@/components/ui/GridPattern'
import { Logo } from '@/components/ui/Logo'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

type AuthMode = 'login' | 'signup'

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
  path: '/api/auth/login' | '/api/auth/signup',
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
  const hasPromo = searchParams.get('promo') === '50off'
  const nextPath = searchParams.get('next') || '/portal'

  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Update state if URL parameters change after initial render
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setMode('signup')
    const urlEmail = searchParams.get('email')
    if (urlEmail) setEmail(urlEmail)
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
      } else {
        const { error } = await submitAuthRequest('/api/auth/signup', {
          email,
          password,
          promoCode: hasPromo ? '50off' : null,
          next: nextPath,
        })
        if (error) {
          setError(error)
        } else {
          setMessage('Check your email for a confirmation link.')
        }
      }
    } catch (error) {
      setError(getAuthErrorMessage(error))
    }

    setLoading(false)
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
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400">
                  {mode === 'login'
                    ? 'Sign in to your account'
                    : 'Get started with NovaSpatial'}
                </p>

                {hasPromo && mode === 'signup' && (
                  <div className="mx-auto mt-6 flex max-w-fit items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
                    ✨ 50% Off Promo Applied
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
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mx-auto mt-10 block w-1/2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? 'Loading...'
                      : mode === 'login'
                        ? 'Sign in'
                        : 'Create account'}
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
                          setError(null)
                          setMessage(null)
                        }}
                        className="font-medium text-violet-400 transition hover:text-violet-300"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login')
                          setError(null)
                          setMessage(null)
                        }}
                        className="font-medium text-violet-400 transition hover:text-violet-300"
                      >
                        Sign in
                      </button>
                    </>
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
