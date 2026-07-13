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

  test('shows the album discount row when the bulk tier applies', () => {
    render(
      <PaymentStep
        clientSecret="cs_test"
        amountCents={130000}
        currency="usd"
        discountApplied={false}
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
})
