import { render, screen, fireEvent, act } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

import { PromoPopup } from './PromoPopup'
import { WELCOME_PROMO_TOKEN } from '@/lib/stripe/pricing'

describe('PromoPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('forwards to the signup link without probing whether the account exists (#52)', () => {
    render(<PromoPopup />)
    act(() => {
      vi.advanceTimersByTime(600)
    })

    fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
      target: { value: 'someone@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /Claim/i }))

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(push).toHaveBeenCalledWith(
      `/login?mode=signup&email=${encodeURIComponent('someone@example.com')}&promo=${WELCOME_PROMO_TOKEN}`,
    )
  })
})
