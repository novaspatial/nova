'use client'

import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { getStripePromise } from '@/lib/stripe/client'
import { formatCurrency } from '@/lib/formatCurrency'
import { discountBadgeLabel } from '@/lib/portal/orderDiscount'
import type { PriceBreakdown } from '@/types/portal'

type Props = {
  clientSecret: string
  amountCents: number
  currency: string
  discountApplied: boolean
  appliedCouponCode: string | null
  breakdown: PriceBreakdown
  onSucceeded: () => void
  onCancel: () => void
}

function PaymentForm({
  amountCents,
  currency,
  discountApplied,
  appliedCouponCode,
  breakdown,
  onSucceeded,
  onCancel,
}: Omit<Props, 'clientSecret'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portal/new`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    // On success, defer to the parent — it will poll payment-status.
    onSucceeded()
    setSubmitting(false)
  }

  // Not amountCents < list_total: amountCents includes GST/HST (#31), so a
  // taxed order would compare a taxed total against an untaxed list price.
  const hasDiscount =
    breakdown.bulk_discount_cents + breakdown.code_discount_cents > 0
  // 'Welcome discount' for the welcome code and the first-mix flag path;
  // any other redeemed code is shown literally (#25).
  const codeLabel = discountBadgeLabel(appliedCouponCode, discountApplied)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
          <span>
            {breakdown.song_count} song{breakdown.song_count > 1 ? 's' : ''} ×{' '}
            {formatCurrency(breakdown.list_unit_cents, currency)}
          </span>
          <span>{formatCurrency(breakdown.list_total_cents, currency)}</span>
        </div>
        {breakdown.bulk_discount_cents > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-300 sm:text-sm">
            <span>Album discount</span>
            <span>−{formatCurrency(breakdown.bulk_discount_cents, currency)}</span>
          </div>
        )}
        {breakdown.code_discount_cents > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs text-violet-300 sm:text-sm">
            <span>{codeLabel ?? 'Welcome discount'}</span>
            <span>−{formatCurrency(breakdown.code_discount_cents, currency)}</span>
          </div>
        )}
        {breakdown.tax_cents > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
            <span>{breakdown.tax_label}</span>
            <span>{formatCurrency(breakdown.tax_cents, currency)}</span>
          </div>
        )}
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="text-xs text-zinc-400 sm:text-sm">Amount due</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-white">
              {formatCurrency(amountCents, currency)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-zinc-500 line-through">
                {formatCurrency(breakdown.list_total_cents, currency)}
              </span>
            )}
            {codeLabel && (
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-xs text-violet-200">
                {codeLabel}
              </span>
            )}
          </div>
          {breakdown.tax_cents > 0 && (
            <div className="mt-1 text-xs text-zinc-500">
              Charged in USD; GST/HST is calculated on the USD amount.
            </div>
          )}
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 sm:text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePay}
          disabled={!stripe || submitting}
          className="flex-1 rounded-xl bg-violet-600 px-6 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {submitting
            ? 'Processing…'
            : `Pay ${formatCurrency(amountCents, currency)} & Start Upload`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function PaymentStep({
  clientSecret,
  amountCents,
  currency,
  discountApplied,
  appliedCouponCode,
  breakdown,
  onSucceeded,
  onCancel,
}: Props) {
  return (
    <Elements
      stripe={getStripePromise()}
      options={{ clientSecret, appearance: { theme: 'night' } }}
    >
      <PaymentForm
        amountCents={amountCents}
        currency={currency}
        discountApplied={discountApplied}
        appliedCouponCode={appliedCouponCode}
        breakdown={breakdown}
        onSucceeded={onSucceeded}
        onCancel={onCancel}
      />
    </Elements>
  )
}
