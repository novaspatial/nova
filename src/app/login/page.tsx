'use client'

import { FadeIn } from '@/components/FadeIn'
import { Footer } from '@/components/Footer'
import { GridPattern } from '@/components/GridPattern'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type AuthMode = 'login' | 'signup'


export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link.')
      }
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
