import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { PortalToastProvider, usePortalToast } from './PortalToast'

function Trigger({
  body,
  durationMs,
}: {
  body?: string
  durationMs?: number
}) {
  const showToast = usePortalToast()
  return (
    <button
      type="button"
      onClick={() =>
        showToast({ title: 'Mixes sent to the client', body, durationMs })
      }
    >
      fire
    </button>
  )
}

describe('PortalToast', () => {
  test('shows a toast with its title and body when fired', async () => {
    render(
      <PortalToastProvider>
        <Trigger body="We emailed them a link." />
      </PortalToastProvider>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'fire' }))

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Mixes sent to the client')
    expect(toast).toHaveTextContent('We emailed them a link.')
  })

  test('dismiss button removes the toast', async () => {
    render(
      <PortalToastProvider>
        <Trigger />
      </PortalToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'fire' }))
    await screen.findByRole('status')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss notification: Mixes sent to the client',
      }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    )
  })

  // Real timers on purpose: AnimatePresence holds the node through an exit
  // animation driven by animation frames, which a faked clock stalls.
  test('auto-dismisses after its duration', async () => {
    render(
      <PortalToastProvider>
        <Trigger durationMs={50} />
      </PortalToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'fire' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    )
  })

  // Deliberate: a toast is feedback, not a contract, so components that use
  // it stay renderable in isolation (unit tests mounting one component).
  test('showing a toast outside the provider is a no-op, not a throw', () => {
    render(<Trigger />)

    fireEvent.click(screen.getByRole('button', { name: 'fire' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
