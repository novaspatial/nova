import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

// House pattern (BlogPostView.test): framer-motion's whileInView needs
// IntersectionObserver, which jsdom lacks — passthrough the animation shell.
vi.mock('@/components/ui/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { PriceCalculator } from './PriceCalculator'
import { computeOrderPrice } from '@/lib/stripe/pricing'
import { FIRST_MIX_CODE, WELCOME_COUPON_CODE } from '@/lib/portal/orderDiscount'
import { formatCurrency } from '@/lib/formatCurrency'

function setSongCount(value: string) {
  fireEvent.change(screen.getByLabelText('Number of Songs'), {
    target: { value },
  })
}

function ctaHref() {
  return screen
    .getByRole('link', { name: 'Start Your Project' })
    .getAttribute('href')
}

describe('PriceCalculator', () => {
  test('defaults to one song with the welcome discount priced into the quote', () => {
    render(<PriceCalculator />)

    const welcome = computeOrderPrice({ songCount: 1, code: FIRST_MIX_CODE })

    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent(
      `1 song × ${formatCurrency(welcome.list_unit_cents)}`,
    )
    // The breakdown itself carries the welcome line and the discounted total.
    expect(quote).toHaveTextContent('Welcome discount')
    expect(quote).toHaveTextContent(
      `−${formatCurrency(welcome.code_discount_cents)}`,
    )
    expect(quote).toHaveTextContent(formatCurrency(welcome.total_cents))
    // Caption scopes the offer to new clients.
    expect(
      screen.getByText(new RegExp(`Includes code ${WELCOME_COUPON_CODE}`)),
    ).toBeInTheDocument()
  })

  test('shows the album discount and drops the welcome pricing once bulk matches it', () => {
    render(<PriceCalculator />)
    setSongCount('4')

    const expected = computeOrderPrice({ songCount: 4 })
    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('Album discount')
    expect(quote).toHaveTextContent(formatCurrency(expected.total_cents))
    // At 3–4 songs bulk (15%) ties WELCOME (15%): no strict win, no welcome line.
    expect(quote).not.toHaveTextContent('Welcome discount')
    expect(
      screen.queryByText(new RegExp(`Includes code ${WELCOME_COUPON_CODE}`)),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(new RegExp('album discount already beats')),
    ).toBeInTheDocument()
  })

  test('add-ons raise the quoted totals via the shared pricing module', () => {
    render(<PriceCalculator />)
    fireEvent.click(screen.getByRole('checkbox', { name: /48-hour rush/ }))

    // 1 song: welcome wins, so the quote is the welcome-discounted breakdown.
    const expected = computeOrderPrice({
      songCount: 1,
      addOns: ['rush_48h'],
      code: FIRST_MIX_CODE,
    })
    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('Add-ons')
    expect(quote).toHaveTextContent(formatCurrency(expected.add_ons_cents))
    expect(quote).toHaveTextContent(formatCurrency(expected.total_cents))
  })

  test('the CTA deep-links the configuration, carrying the code only when it wins', () => {
    render(<PriceCalculator />)
    setSongCount('2')
    fireEvent.click(screen.getByRole('checkbox', { name: /48-hour rush/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Extra revision/ }))

    expect(ctaHref()).toBe(
      `/portal/new?songs=2&addons=rush_48h%2Cextra_revision&code=${WELCOME_COUPON_CODE}`,
    )

    // 5+ songs: the bulk tier beats WELCOME — the code must not ride along.
    setSongCount('5')
    expect(ctaHref()).toBe('/portal/new?songs=5&addons=rush_48h%2Cextra_revision')
  })

  test('an invalid song count hides the quote and falls back to a bare CTA', () => {
    render(<PriceCalculator />)
    setSongCount('0')

    expect(screen.queryByTestId('live-quote')).not.toBeInTheDocument()
    expect(ctaHref()).toBe('/portal/new')
  })

  test('the stepper buttons adjust the song count', () => {
    render(<PriceCalculator />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Increase number of songs' }),
    )
    expect(screen.getByLabelText('Number of Songs')).toHaveValue(2)
    expect(screen.getByTestId('live-quote')).toHaveTextContent('2 songs ×')

    fireEvent.click(
      screen.getByRole('button', { name: 'Decrease number of songs' }),
    )
    expect(screen.getByLabelText('Number of Songs')).toHaveValue(1)
  })
})
