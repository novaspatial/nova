'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

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

  useEffect(() => {
    if (sessionStorage.getItem('promo-dismissed')) {
      return
    }

    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
    sessionStorage.setItem('promo-dismissed', '1')
  }

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 z-10 hidden w-[320px] lg:block xl:w-90"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-violet-500/10 backdrop-blur-xl">
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
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
                </svg>
                Limited Offer
              </div>

              <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                50% off your first mixes
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Create an account today and get an exclusive 50% discount on your first Atmos mix session.
              </p>

              <div className="mt-5 flex justify-center">
              <Link
                href="/login"
                onClick={handleDismiss}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700"
              >
                Create your account
                <svg viewBox="0 0 16 6" className="w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16 3 10 .5v2H0v1h10v2L16 3Z"
                  />
                </svg>
              </Link>
              </div>

              <p className="mt-3 text-center text-[11px] text-zinc-500">
                Discount applied automatically at checkout.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
