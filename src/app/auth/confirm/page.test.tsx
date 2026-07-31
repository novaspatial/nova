import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

import ConfirmEmailPage from './page'

async function renderPage(
  params: Record<string, string | string[] | undefined>,
) {
  return render(
    await ConfirmEmailPage({ searchParams: Promise.resolve(params) }),
  )
}

describe('/auth/confirm page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders only a confirm button for a valid signup link', async () => {
    const { container } = await renderPage({
      token_hash: 'abc',
      type: 'signup',
      next: '/portal',
    })

    expect(
      screen.getByRole('button', { name: 'Confirm my email' }),
    ).toBeInTheDocument()

    const form = container.querySelector('form[action="/api/auth/confirm"]')
    expect(form).toHaveAttribute('action', '/api/auth/confirm')
    expect(form).toHaveAttribute('method', 'post')
    expect(
      container.querySelector('input[name="token_hash"]'),
    ).toHaveAttribute('value', 'abc')
    expect(container.querySelector('input[name="type"]')).toHaveAttribute(
      'value',
      'signup',
    )
    expect(container.querySelector('input[name="next"]')).toHaveAttribute(
      'value',
      '/portal',
    )
  })

  test('renders recovery copy for a password-reset link', async () => {
    await renderPage({ token_hash: 'abc', type: 'recovery' })

    expect(
      screen.getByRole('heading', { name: 'Reset your password' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue password reset' }),
    ).toBeInTheDocument()
  })

  test('defaults the recovery next target to update-password', async () => {
    const { container } = await renderPage({
      token_hash: 'abc',
      type: 'recovery',
    })

    expect(container.querySelector('input[name="next"]')).toHaveAttribute(
      'value',
      '/auth/update-password',
    )
  })

  test('shows the invalid-link card when the token is missing', async () => {
    const { container } = await renderPage({ type: 'signup' })

    expect(
      screen.getByText(/This confirmation link is invalid/),
    ).toBeInTheDocument()
    expect(container.querySelector('form[action="/api/auth/confirm"]')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  test('rejects a type outside the allowlist', async () => {
    const { container } = await renderPage({
      token_hash: 'abc',
      type: 'magiclink',
    })

    expect(
      screen.getByText(/This confirmation link is invalid/),
    ).toBeInTheDocument()
    expect(container.querySelector('form[action="/api/auth/confirm"]')).not.toBeInTheDocument()
  })

  test('rejects array-valued params', async () => {
    const { container } = await renderPage({
      token_hash: ['a', 'b'],
      type: 'signup',
    })

    expect(container.querySelector('form[action="/api/auth/confirm"]')).not.toBeInTheDocument()
  })

  test('keeps the form usable after a transient network failure', async () => {
    const { container } = await renderPage({
      token_hash: 'abc',
      type: 'signup',
      next: '/portal',
      error: 'retry',
    })

    expect(
      screen.getByText(/couldn't reach the authentication service/i),
    ).toBeInTheDocument()
    expect(
      container.querySelector('input[name="token_hash"]'),
    ).toHaveAttribute('value', 'abc')
    expect(
      screen.getByRole('button', { name: 'Confirm my email' }),
    ).toBeInTheDocument()
  })

  test('sanitizes an off-origin next in the hidden field (#56)', async () => {
    const { container } = await renderPage({
      token_hash: 'abc',
      type: 'signup',
      next: '//evil.example',
    })

    expect(container.querySelector('input[name="next"]')).toHaveAttribute(
      'value',
      '/portal',
    )
  })
})
