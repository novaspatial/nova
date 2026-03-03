'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { checkEmail } from '../../app/actions/checkEmail'

function CloseIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="m17.25 6.75-10.5 10.5M6.75 6.75l10.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PromoPopup() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (
      localStorage.getItem('promo-dismissed') ||
      localStorage.getItem('email-promo-submitted')
    ) {
      return
    }

    const handleShow = () => setVisible(true)
    const handleHide = () => setVisible(false)

    window.addEventListener('show-promo-popup', handleShow)
    window.addEventListener('hide-promo-popup', handleHide)

    let timer: NodeJS.Timeout | undefined
    if (localStorage.getItem('email-promo-rejected')) {
      timer = setTimeout(() => setVisible(true), 500)
    }

    return () => {
      window.removeEventListener('show-promo-popup', handleShow)
      window.removeEventListener('hide-promo-popup', handleHide)
      if (timer) clearTimeout(timer)
    }
  }, [])

  function handleDismiss() {
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
    localStorage.setItem('promo-dismissed', '1')
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
        <motion.div
          initial={{ opacity: 0, y: '100%', scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: '100%', scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-50 lg:absolute lg:inset-auto lg:top-0 lg:right-0 lg:z-10 lg:w-[320px] xl:w-90"
        >
          <div className="relative overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-zinc-900/95 shadow-2xl shadow-violet-500/10 backdrop-blur-xl lg:rounded-2xl lg:border-b">
            <div className="h-1 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500" />

            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3 right-3 rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="px-6 pt-6 pb-7">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold tracking-wide text-violet-300">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                    clipRule="evenodd"
                  />
                </svg>
                Limited Offer
              </div>

              <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                50% off your first mixes
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Create an account today and get an exclusive 50% discount on
                your first Atmos mix session.
              </p>

              {submitted ? (
                <div className="mt-5 rounded-xl bg-white/5 p-4 border border-white/10 text-center">
                  <p className="text-sm font-medium text-white">Thanks! Check your email.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-5">
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    >
                      {loading ? 'Checking...' : 'Claim 50% Off'}
                    </button>
                  </div>
                  {errorMsg && (
                    <p className="mt-2 text-center text-xs text-red-400">
                      {errorMsg}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
