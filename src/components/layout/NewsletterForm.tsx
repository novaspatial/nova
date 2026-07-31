'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WELCOME_DISCOUNT_PCT, WELCOME_PROMO_TOKEN } from '@/lib/stripe/pricing'

function ArrowIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 6" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 3 10 .5v2H0v1h10v2L16 3Z"
      />
    </svg>
  )
}

/**
 * The footer's welcome-offer capture (#59).
 *
 * It used to be a Subscribe form wired to nothing: it promised a discount
 * and every submission was a silent no-op. It now does what the promo
 * popup does — hand the address to the signup form with the promo token
 * attached, so the offer the copy promises is the one the account is
 * created with. There is no list, no subscribe endpoint, and no email
 * sent from here; the welcome discount is code-enforced at checkout
 * (D11), so forwarding is the whole mechanism.
 *
 * Like the popup, it never checks whether the address already exists
 * (#52): any answer would be an enumeration oracle. Supabase's own
 * obfuscated reply handles an already-registered address.
 */
export function NewsletterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!email) return
    router.push(
      `/login?mode=signup&email=${encodeURIComponent(email)}&promo=${WELCOME_PROMO_TOKEN}`,
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-102 text-center lg:text-left 3xl:max-w-118"
    >
      <h2 className="font-display text-[10px] font-semibold tracking-wider text-white sm:text-sm 3xl:text-base">
        Claim your welcome discount
      </h2>
      <p className="mt-2 text-[10px] text-white/70 sm:mt-4 sm:text-sm 3xl:text-base">
        Get a {WELCOME_DISCOUNT_PCT}% welcome discount on your first Atmos
        mix.
      </p>
      <div className="relative mt-3 sm:mt-6">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          autoComplete="email"
          aria-label="Email address"
          className="block w-full rounded-xl border border-white/20 bg-transparent py-2 pr-12 pl-3 text-[10px] text-white ring-4 ring-transparent transition placeholder:text-white/50 focus:border-violet-400 focus:ring-violet-500/10 focus:outline-hidden sm:rounded-2xl sm:py-4 sm:pr-20 sm:pl-6 sm:text-base/6 3xl:py-5 3xl:pl-8 3xl:text-lg"
        />
        <div className="absolute inset-y-0.5 right-0.5 flex justify-end sm:inset-y-1 sm:right-1">
          <button
            type="submit"
            aria-label="Claim your welcome discount"
            className="flex aspect-square h-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-900 via-violet-800 to-purple-900 text-white transition hover:from-indigo-950 hover:via-violet-900 hover:to-purple-950 sm:rounded-xl"
          >
            <ArrowIcon className="w-3 sm:w-4 3xl:w-5" />
          </button>
        </div>
      </div>
    </form>
  )
}
