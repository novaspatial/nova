import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
// Swappable per test; the factory closure reads it at hook-call time.
let params = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => params,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import LoginPage from './page'

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }
}

async function submitSignup() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'user@test.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret123' },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByText('Check your email for a confirmation link.')
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params = new URLSearchParams()
  })

  test('renders the friendly message for a used confirmation link', async () => {
    params = new URLSearchParams('error=confirm-link-used')

    render(<LoginPage />)

    expect(
      await screen.findByText(/That confirmation link was already used/),
    ).toBeInTheDocument()
  })

  test('renders the generic error for a failed auth code exchange', async () => {
    params = new URLSearchParams('error=auth-code-error')

    render(<LoginPage />)

    expect(
      await screen.findByText(/That sign-in link didn't work/),
    ).toBeInTheDocument()
  })

  test('switches to reset mode with reset-specific guidance for a used recovery link', async () => {
    params = new URLSearchParams('error=recovery-link-used')

    render(<LoginPage />)

    expect(
      await screen.findByText(/That password reset link was already used/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeInTheDocument()
    // Resend-confirmation is signup-specific; a recovery arrival shouldn't
    // offer it — the reset form's own submit is the correct self-serve path.
    expect(
      screen.queryByRole('button', {
        name: "Didn't get it? Resend confirmation email",
      }),
    ).not.toBeInTheDocument()
  })

  test('arms the resend control for a stale confirmation link, gated on an email', async () => {
    params = new URLSearchParams('error=confirm-link-used')

    render(<LoginPage />)
    await screen.findByText(/That confirmation link was already used/)

    const resendButton = screen.getByRole('button', {
      name: "Didn't get it? Resend confirmation email",
    })
    expect(resendButton).toBeDisabled()
    expect(
      screen.getByText('Enter your email above first.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@test.com' },
    })

    expect(resendButton).toBeEnabled()
  })

  test('ignores unknown error codes', async () => {
    params = new URLSearchParams('error=garbage')

    render(<LoginPage />)

    await screen.findByRole('button', { name: 'Sign in' })
    expect(
      screen.queryByText(/That confirmation link was already used/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/That sign-in link didn't work/),
    ).not.toBeInTheDocument()
  })

  test('offers a resend button after a successful signup', async () => {
    params = new URLSearchParams('mode=signup')
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    render(<LoginPage />)
    await submitSignup()

    expect(
      screen.getByRole('button', {
        name: "Didn't get it? Resend confirmation email",
      }),
    ).toBeInTheDocument()
  })

  test('resends the confirmation email and enters cooldown', async () => {
    params = new URLSearchParams('mode=signup')
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    render(<LoginPage />)
    await submitSignup()

    fireEvent.click(
      screen.getByRole('button', {
        name: "Didn't get it? Resend confirmation email",
      }),
    )

    await screen.findByText(/We've sent another confirmation email/)
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/auth/resend-confirmation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@test.com', next: '/portal' }),
      }),
    )
    const cooldownButton = screen.getByRole('button', {
      name: 'Confirmation email sent',
    })
    expect(cooldownButton).toBeDisabled()
  })

  test('surfaces a real resend failure and re-enables the button', async () => {
    // The resend endpoint swallows GoTrue's cooldown for existence
    // obfuscation, so the only errors that reach the UI are real ones
    // (network/misconfig) — verify those still surface and recover.
    const outage =
      'Unable to reach the authentication service. Please try again in a moment.'
    params = new URLSearchParams('mode=signup')
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse({ error: outage }, { ok: false, status: 503 }),
      )

    render(<LoginPage />)
    await submitSignup()

    fireEvent.click(
      screen.getByRole('button', {
        name: "Didn't get it? Resend confirmation email",
      }),
    )

    expect(await screen.findByText(outage)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: "Didn't get it? Resend confirmation email",
      }),
    ).toBeEnabled()
  })

  test('hides the resend button after switching modes', async () => {
    params = new URLSearchParams('mode=signup')
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    render(<LoginPage />)
    await submitSignup()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: "Didn't get it? Resend confirmation email",
        }),
      ).not.toBeInTheDocument()
    })
  })
})
