'use client'

import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { getStripePromise } from '@/lib/stripe/client'
import { FULL_PRICE_CENTS } from '@/lib/stripe/pricing'

type Props = {
  clientSecret: string
  amountCents: number
  currency: string
  discountApplied: boolean
  onSucceeded: () => void
  onCancel: () => void
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function PaymentForm({
  amountCents,
  currency,
  discountApplied,
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-zinc-400 sm:text-sm">Amount due</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-2xl font-semibold text-white">
            {formatPrice(amountCents, currency)}
          </span>
          {discountApplied && (
            <>
              <span className="text-sm text-zinc-500 line-through">
                {formatPrice(FULL_PRICE_CENTS, currency)}
              </span>
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-xs text-violet-200">
                First mix discount
              </span>
            </>
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
            : `Pay ${formatPrice(amountCents, currency)} & Start Upload`}
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
        onSucceeded={onSucceeded}
        onCancel={onCancel}
      />
    </Elements>
  )
}
