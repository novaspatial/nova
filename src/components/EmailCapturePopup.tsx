'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { checkEmail } from '../app/actions/checkEmail'

export function EmailCapturePopup() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (localStorage.getItem('email-promo-dismissed')) {
      return
    }

    const timer = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
    localStorage.setItem('email-promo-dismissed', '1')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setErrorMsg('')

    const { exists } = await checkEmail(email)

    if (exists) {
      setLoading(false)
      setErrorMsg('This email is already registered.')
      return
    }

    setSubmitted(true)
    setTimeout(() => {
      router.push(`/login?mode=signup&email=${encodeURIComponent(email)}&promo=50off`)
      handleDismiss()
    }, 1500)
  }

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="group relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl shadow-violet-500/20 transition-all duration-500 hover:shadow-violet-500/40 hover:border-white/20"
          >
            <div className="h-2 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500 group-hover:from-indigo-400 group-hover:via-violet-400 group-hover:to-purple-400 transition-colors duration-500" />

            <div className="px-6 py-10 sm:px-10 sm:py-12 text-center">
              <div className="relative mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 text-violet-300 transition-transform duration-500 group-hover:scale-110">
                <div className="absolute inset-0 rounded-full border border-violet-500/30 group-hover:border-violet-400/60 group-hover:animate-[spin_4s_linear_infinite]" />
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-8 w-8"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>

              <h3 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Wait! Get 50% Off
              </h3>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 border-b border-white/5 pb-6">
                Enter your email address to unlock an exclusive 50% discount on your first Atmos mix session. Don&apos;t miss out!
              </p>

              {submitted ? (
                <div className="mt-8 rounded-2xl bg-white/5 p-6 border border-white/10">
                  <p className="text-lg font-medium text-white">Thanks! Check your email.</p>
                  <p className="text-sm text-zinc-400 mt-2">Connecting you now...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 hover:shadow-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {loading ? 'Checking...' : 'Claim 50% Off'}
                    </button>
                  </div>
                  
                  {errorMsg && (
                    <p className="mt-3 text-sm text-red-400">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="mt-6 text-sm text-zinc-500 underline decoration-zinc-500/30 underline-offset-4 transition hover:text-zinc-300"
                  >
                    No thanks, I prefer paying full price
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
