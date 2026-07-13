import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { PriceBreakdown } from '@/types/portal'

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({}),
  useElements: () => ({}),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripePromise: () => null,
}))

import { PaymentStep } from './PaymentStep'

function makeBreakdown(overrides: Partial<PriceBreakdown> = {}): PriceBreakdown {
  return {
    currency: 'usd',
    song_count: 1,
    list_unit_cents: 32500,
    list_total_cents: 32500,
    bulk_discount_cents: 0,
    code_discount_cents: 0,
    add_ons_cents: 0,
    subtotal_cents: 32500,
    tax_cents: 0,
    tax_rate_pct: 0,
    tax_label: null,
    total_cents: 32500,
    ...overrides,
  }
}

const noop = () => {}

describe('PaymentStep', () => {
  test('shows the undiscounted single-song total with no discount rows', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={32500}
        currency="usd"
        discountApplied={false}
        appliedCouponCode={null}
        breakdown={makeBreakdown()}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    expect(screen.getByText('1 song × $325')).toBeInTheDocument()
    expect(screen.queryByText('Album discount')).not.toBeInTheDocument()
    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay $325 & Start Upload' }),
    ).toBeInTheDocument()
  })

  test('itemizes the welcome discount and strikes through the list total', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={221000}
        currency="usd"
        discountApplied
        appliedCouponCode="WELCOME"
        breakdown={makeBreakdown({
          song_count: 8,
          list_total_cents: 260000,
          code_discount_cents: 39000,
          subtotal_cents: 221000,
          total_cents: 221000,
        })}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    expect(screen.getByText('8 songs × $325')).toBeInTheDocument()
    expect(screen.getByText('−$390')).toBeInTheDocument()
    // Discount row label + badge both say "Welcome discount".
    expect(screen.getAllByText('Welcome discount')).toHaveLength(2)
    // The list total renders twice: as the line item and as the strikethrough.
    const listTotals = screen.getAllByText('$2,600')
    expect(listTotals.some((el) => el.classList.contains('line-through'))).toBe(
      true,
    )
    expect(
      screen.getByRole('button', { name: 'Pay $2,210 & Start Upload' }),
    ).toBeInTheDocument()
  })

  test('itemizes GST/HST without a discount strikethrough on a taxed order', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={36725}
        currency="usd"
        discountApplied={false}
        appliedCouponCode={null}
        breakdown={makeBreakdown({
          tax_cents: 4225,
          tax_rate_pct: 13,
          tax_label: 'HST (13%)',
          total_cents: 36725,
        })}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    expect(screen.getByText('HST (13%)')).toBeInTheDocument()
    expect(screen.getByText('$42.25')).toBeInTheDocument()
    expect(
      screen.getByText('Charged in USD; GST/HST is calculated on the USD amount.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay $367.25 & Start Upload' }),
    ).toBeInTheDocument()
    // amountCents (36725) exceeds the list total (32500) because of tax, yet
    // nothing was discounted — no strikethrough may render (pins the
    // hasDiscount fix: discounts, not an amount comparison).
    expect(screen.getAllByText('$325')).toHaveLength(1)
    expect(screen.getByText('$325')).not.toHaveClass('line-through')
  })

  test('shows the album discount row when the bulk tier applies', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={130000}
        currency="usd"
        discountApplied={false}
        appliedCouponCode={null}
        breakdown={makeBreakdown({
          song_count: 5,
          list_total_cents: 162500,
          bulk_discount_cents: 32500,
          subtotal_cents: 130000,
          total_cents: 130000,
        })}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    expect(screen.getByText('Album discount')).toBeInTheDocument()
    expect(screen.getByText('−$325')).toBeInTheDocument()
    const listTotals = screen.getAllByText('$1,625')
    expect(listTotals.some((el) => el.classList.contains('line-through'))).toBe(
      true,
    )
  })

  test('labels a catalog-code discount with the literal code', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={29250}
        currency="usd"
        discountApplied={false}
        appliedCouponCode="SUMMER10"
        breakdown={makeBreakdown({
          code_discount_cents: 3250,
          subtotal_cents: 29250,
          total_cents: 29250,
        })}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    // Discount row label + badge both show the literal code (#25).
    expect(screen.getAllByText('Discount · SUMMER10')).toHaveLength(2)
    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument()
  })

  test('keeps the Welcome badge for the first-mix flag path', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={27625}
        currency="usd"
        discountApplied
        appliedCouponCode={null}
        breakdown={makeBreakdown({
          code_discount_cents: 4875,
          subtotal_cents: 27625,
          total_cents: 27625,
        })}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    // No coupon code, but the legacy first-mix flag still reads as welcome.
    expect(screen.getAllByText('Welcome discount')).toHaveLength(2)
  })

  test('shows no badge when no discount applied', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={32500}
        currency="usd"
        discountApplied={false}
        appliedCouponCode={null}
        breakdown={makeBreakdown()}
        onSucceeded={noop}
        onCancel={noop}
      />,
    )

    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument()
    expect(screen.queryByText(/Discount ·/)).not.toBeInTheDocument()
  })
})
