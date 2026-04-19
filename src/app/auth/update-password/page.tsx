'use client'

import { FadeIn } from '@/components/ui/FadeIn'
import { Footer } from '@/components/layout/Footer'
import { GridPattern } from '@/components/ui/GridPattern'
import { Logo } from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setHasSession(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const supabase = createClient()
    if (!supabase) {
      setError('Authentication is not configured.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message || 'Unable to update password.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
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
                  Set a new password
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400">
                  Choose a new password for your account
                </p>

                {hasSession === false ? (
                  <div className="mt-8 space-y-4">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                      This password reset link is invalid or has expired.
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
                ) : (
                  <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-zinc-300"
                      >
                        New password
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

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-zinc-300"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || hasSession === null}
                      className="mx-auto mt-10 block w-1/2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update password'}
                    </button>
                  </form>
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
