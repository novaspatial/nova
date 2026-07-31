import { fireEvent, render, screen } from '@testing-library/react'
import { WELCOME_DISCOUNT_PCT, WELCOME_PROMO_TOKEN } from '@/lib/stripe/pricing'
import { NewsletterForm } from './NewsletterForm'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('NewsletterForm', () => {
  beforeEach(() => vi.clearAllMocks())

  test('forwards the address to signup with the promo token attached', () => {
    const { container } = render(<NewsletterForm />)

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.submit(container.querySelector('form')!)

    // Same destination the promo popup uses, so both entry points create
    // the account against the same offer.
    expect(push).toHaveBeenCalledWith(
      `/login?mode=signup&email=ada%40example.com&promo=${WELCOME_PROMO_TOKEN}`,
    )
  })

  test('does nothing on an empty submit — no navigation, no dead promise', () => {
    const { container } = render(<NewsletterForm />)

    fireEvent.submit(container.querySelector('form')!)
    expect(push).not.toHaveBeenCalled()
  })

  test('advertises the discount from the shared pricing constant', () => {
    render(<NewsletterForm />)
    expect(
      screen.getByText(new RegExp(`${WELCOME_DISCOUNT_PCT}% welcome discount`)),
    ).toBeInTheDocument()
  })
})
