import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { QuoteBreakdown } from './QuoteBreakdown'
import { computeOrderPrice } from '@/lib/stripe/pricing'
import { FIRST_MIX_CODE } from '@/lib/portal/orderDiscount'
import { formatCurrency } from '@/lib/formatCurrency'

describe('QuoteBreakdown', () => {
  test('renders the list line and total inside an aria-live region', () => {
    const quote = computeOrderPrice({ songCount: 1 })
    render(<QuoteBreakdown quote={quote} />)

    const region = screen.getByTestId('live-quote')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(
      within(region).getByText(`1 song × ${formatCurrency(quote.list_unit_cents)}`),
    ).toBeInTheDocument()
    // 1 untaxed song: the list line and the total both read $325.
    expect(
      within(region).getAllByText(formatCurrency(quote.total_cents)),
    ).toHaveLength(2)
    expect(within(region).queryByText('Album discount')).not.toBeInTheDocument()
    expect(within(region).queryByText('Add-ons')).not.toBeInTheDocument()
  })

  test('shows the album discount line when the bulk tier binds', () => {
    const quote = computeOrderPrice({ songCount: 4 })
    render(<QuoteBreakdown quote={quote} />)

    expect(screen.getByText('Album discount')).toBeInTheDocument()
    expect(
      screen.getByText(`−${formatCurrency(quote.bulk_discount_cents)}`),
    ).toBeInTheDocument()
  })

  test('shows the code line only when both a label and cents are present', () => {
    const discounted = computeOrderPrice({ songCount: 1, code: FIRST_MIX_CODE })
    const { rerender } = render(
      <QuoteBreakdown quote={discounted} codeLabel="Welcome discount" />,
    )
    expect(screen.getByText('Welcome discount')).toBeInTheDocument()
    expect(
      screen.getByText(`−${formatCurrency(discounted.code_discount_cents)}`),
    ).toBeInTheDocument()

    // No label → no line, even with a discounted breakdown.
    rerender(<QuoteBreakdown quote={discounted} />)
    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument()

    // Label but a zero-discount breakdown → no line.
    rerender(
      <QuoteBreakdown
        quote={computeOrderPrice({ songCount: 1 })}
        codeLabel="Welcome discount"
      />,
    )
    expect(screen.queryByText('Welcome discount')).not.toBeInTheDocument()
  })

  test('shows add-ons and tax lines when the breakdown carries them', () => {
    const quote = computeOrderPrice({
      songCount: 2,
      addOns: ['rush_48h'],
      buyer: { country: 'CA', province: 'ON' },
    })
    render(<QuoteBreakdown quote={quote} />)

    expect(screen.getByText('Add-ons')).toBeInTheDocument()
    expect(
      screen.getByText(formatCurrency(quote.add_ons_cents)),
    ).toBeInTheDocument()
    expect(screen.getByText(quote.tax_label!)).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(quote.tax_cents))).toBeInTheDocument()
  })

  test('renders the footnote when provided', () => {
    render(
      <QuoteBreakdown
        quote={computeOrderPrice({ songCount: 1 })}
        footnote="Prices in USD, before tax."
      />,
    )
    expect(screen.getByText('Prices in USD, before tax.')).toBeInTheDocument()
  })
})
