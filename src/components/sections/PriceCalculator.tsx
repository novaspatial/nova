'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { Checkbox } from '@/components/ui/Checkbox'
import { NumberInput } from '@/components/ui/NumberInput'
// Direct import (not the portal barrel) so the marketing bundle doesn't pull
// PaymentStep's Stripe dependencies.
import { QuoteBreakdown } from '@/components/portal/QuoteBreakdown'
import type { AddOn } from '@/types/portal'
import {
  ADD_ON_CENTS,
  ADD_ON_LABELS,
  ADD_ON_VALUES,
  computeOrderPrice,
  MAX_SONG_COUNT,
  WELCOME_DISCOUNT_PCT,
} from '@/lib/stripe/pricing'
import {
  discountBadgeLabel,
  FIRST_MIX_CODE,
  WELCOME_COUPON_CODE,
} from '@/lib/portal/orderDiscount'
import { formatCurrency } from '@/lib/formatCurrency'

const ADD_ON_OPTIONS = ADD_ON_VALUES.map((value) => ({
  value,
  label: `${ADD_ON_LABELS[value]} (+${formatCurrency(ADD_ON_CENTS[value])})`,
}))

// Homepage price calculator (#30): the interactive start of the new-project
// flow. Every figure comes from computeOrderPrice — the same module the
// checkout charge uses — with no billing location, so totals are pre-tax.
// The CTA deep-links the configuration into /portal/new (the params survive
// the login redirect); checkout re-validates everything server-side.
export function PriceCalculator() {
  const [songCountInput, setSongCountInput] = useState('1')
  const [addOns, setAddOns] = useState<AddOn[]>([])

  // Same parsing as the order form: Number() so exponent notation can't
  // silently truncate.
  const songCount =
    songCountInput.trim() === '' ? NaN : Number(songCountInput)
  const songCountValid =
    Number.isInteger(songCount) && songCount >= 1 && songCount <= MAX_SONG_COUNT

  const { base, welcome } = useMemo(() => {
    if (!songCountValid) return { base: null, welcome: null }
    return {
      base: computeOrderPrice({ songCount, addOns }),
      // FIRST_MIX_CODE is the real WELCOME OrderCode (private — it suppresses
      // the bulk tier), so this preview equals what checkout would charge.
      welcome: computeOrderPrice({ songCount, addOns, code: FIRST_MIX_CODE }),
    }
  }, [songCountValid, songCount, addOns])

  // Only advertise (and deep-link) the welcome code when it strictly lowers
  // the total: WELCOME doesn't stack with the bulk tier, so from 3 songs the
  // album discount matches or beats it.
  const welcomeWins =
    base !== null && welcome !== null && welcome.total_cents < base.total_cents

  // Show the welcome-discounted price in the quote itself when it wins —
  // the breakdown's list line + "Welcome discount" line keep the saving
  // visible, and the caption below scopes it to new clients.
  const displayedQuote = welcomeWins ? welcome : base
  const codeLabel = welcomeWins
    ? discountBadgeLabel(WELCOME_COUPON_CODE, false)
    : null

  const ctaHref = useMemo(() => {
    if (!songCountValid) return '/portal/new'
    const params = new URLSearchParams({ songs: String(songCount) })
    if (addOns.length > 0) params.set('addons', addOns.join(','))
    if (welcomeWins) params.set('code', WELCOME_COUPON_CODE)
    return `/portal/new?${params.toString()}`
  }, [songCountValid, songCount, addOns, welcomeWins])

  const toggleAddOn = (addOn: AddOn) => (checked: boolean) => {
    setAddOns((prev) =>
      checked ? [...prev, addOn] : prev.filter((a) => a !== addOn),
    )
  }

  return (
    <section
      id="pricing"
      className="mt-10 mb-8 scroll-mt-28 sm:mt-16 sm:mb-20 md:mt-20 xl:mt-24 xl:mb-20 3xl:mt-32 3xl:mb-24"
    >
      <Container>
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center 3xl:max-w-3xl">
            <h2 className="font-display text-xl font-medium tracking-tight text-white sm:text-2xl md:text-4xl lg:text-5xl 3xl:text-6xl">
              Price Your Mix
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-300 sm:mt-5 sm:text-base md:text-lg 3xl:mt-6 3xl:text-xl">
              Per-song pricing with automatic album discounts. Configure your
              project and carry it straight into the portal.
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white/3 p-5 ring-1 ring-white/10 backdrop-blur-sm sm:mt-10 sm:p-7 3xl:mt-12 3xl:p-9">
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="calculator-song-count"
                    className="block text-xs font-medium text-zinc-300 sm:text-sm"
                  >
                    Number of Songs
                  </label>
                  <NumberInput
                    id="calculator-song-count"
                    label="number of songs"
                    min={1}
                    max={MAX_SONG_COUNT}
                    value={songCountInput}
                    onChange={setSongCountInput}
                    className="mt-2"
                  />
                </div>

                <fieldset>
                  <legend className="block text-xs font-medium text-zinc-300 sm:text-sm">
                    Add-ons
                  </legend>
                  <div className="mt-2 space-y-2">
                    {ADD_ON_OPTIONS.map((option) => (
                      <Checkbox
                        key={option.value}
                        isSelected={addOns.includes(option.value)}
                        onChange={toggleAddOn(option.value)}
                      >
                        <span className="text-xs text-zinc-300 sm:text-sm">
                          {option.label}
                        </span>
                      </Checkbox>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="space-y-3">
                {displayedQuote && (
                  <QuoteBreakdown
                    quote={displayedQuote}
                    codeLabel={codeLabel}
                    footnote="Prices in USD, before tax. Taxes and discounts are finalized at checkout."
                  />
                )}
                {welcomeWins && (
                  <p className="text-xs text-violet-300 sm:text-sm">
                    Includes code {WELCOME_COUPON_CODE} —{' '}
                    {WELCOME_DISCOUNT_PCT}% off your first mix for new
                    clients, verified at checkout.
                  </p>
                )}
                {base && !welcomeWins && (
                  <p className="text-xs text-zinc-500 sm:text-sm">
                    Your album discount already beats the {WELCOME_COUPON_CODE}{' '}
                    welcome offer.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-7 flex justify-center sm:mt-9 3xl:mt-11">
              <Link
                href={ctaHref}
                className="group/cta relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-violet-950 via-purple-900 to-violet-950 px-5 py-2.5 text-xs font-semibold text-white ring-1 ring-violet-400/30 transition-all duration-300 hover:scale-[1.03] hover:ring-violet-300/50 hover:shadow-lg hover:shadow-violet-500/30 sm:px-7 sm:py-3 sm:text-sm 3xl:px-8 3xl:py-3.5 3xl:text-base"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
                <span className="relative">Start Your Project</span>
              </Link>
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  )
}
