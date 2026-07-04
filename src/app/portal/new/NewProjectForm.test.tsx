import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { FileUploadItem } from '@/types/portal'
import { TERMS_VERSION } from '@/lib/legal/terms'

vi.mock('@/components/portal', () => ({
  FileUploader: ({
    files,
    onFilesAdded,
  }: {
    files: FileUploadItem[]
    onFilesAdded: (files: File[]) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onFilesAdded([
            new File(['a'], 'kick.wav', { type: 'audio/x-wav' }),
            new File(['b'], 'snare.wav', { type: 'audio/x-wav' }),
          ])
        }
      >
        Add stems
      </button>
      <span data-testid="file-count">{files.length}</span>
    </div>
  ),
  PaymentStep: ({ amountCents }: { amountCents: number }) => (
    <div data-testid="payment-step">{amountCents}</div>
  ),
}))

import { NewProjectForm } from './NewProjectForm'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function fillRequiredFields(songCount = '1') {
  fireEvent.change(screen.getByLabelText('Project Title'), {
    target: { value: 'My Album' },
  })
  fireEvent.change(screen.getByLabelText('Number of Songs'), {
    target: { value: songCount },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add stems' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /agree to the Terms/i }))
}

describe('NewProjectForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders a live quote that reflects the song count and bulk tier', () => {
    render(<NewProjectForm />)

    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('1 song × $325')
    expect(quote).not.toHaveTextContent('Album discount')

    fireEvent.change(screen.getByLabelText('Number of Songs'), {
      target: { value: '5' },
    })
    expect(quote).toHaveTextContent('5 songs × $325')
    expect(quote).toHaveTextContent('$1,625')
    expect(quote).toHaveTextContent('Album discount')
    expect(quote).toHaveTextContent('−$325')
    expect(quote).toHaveTextContent('$1,300')
  })

  test('hides the quote while the song count is invalid', () => {
    render(<NewProjectForm />)
    fireEvent.change(screen.getByLabelText('Number of Songs'), {
      target: { value: '0' },
    })
    expect(screen.queryByTestId('live-quote')).not.toBeInTheDocument()
  })

  test('submits the order fields and derives stemCount from the selected files', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        projectId: 'proj-1',
        clientSecret: 'cs_test',
        amountCents: 130000,
        currency: 'usd',
        discountApplied: false,
        breakdown: {
          currency: 'usd',
          song_count: 5,
          list_unit_cents: 32500,
          list_total_cents: 162500,
          bulk_discount_cents: 32500,
          code_discount_cents: 0,
          add_ons_cents: 0,
          subtotal_cents: 130000,
          tax_cents: 0,
          total_cents: 130000,
        },
      }),
    })

    render(<NewProjectForm />)
    fillRequiredFields('5')
    fireEvent.change(screen.getByLabelText('Service'), {
      target: { value: 'both' },
    })
    fireEvent.change(screen.getByLabelText(/Reference Tracks/), {
      target: { value: 'Song X — Artist Y' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('payment-step')).toHaveTextContent('130000')
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/portal/projects/checkout',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body).toEqual({
      title: 'My Album',
      format: 'both',
      songCount: 5,
      stemCount: 2,
      referenceTracks: 'Song X — Artist Y',
      notes: null,
      termsAcceptedVersion: TERMS_VERSION,
    })
  })

  test('blocks submit until the terms are accepted', async () => {
    render(<NewProjectForm />)
    // Fill everything EXCEPT the consent checkbox.
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'My Album' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add stems' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /accept the Terms/,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('rejects an invalid song count without calling the API', async () => {
    render(<NewProjectForm />)
    // '0' passes the native `required` check; the JS guard must catch it.
    fillRequiredFields('0')
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Project & Upload' })
        .closest('form') as HTMLFormElement,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Song count must be a whole number/,
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('surfaces an error instead of re-enabling the form when the response has no client secret', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        projectId: 'proj-1',
        clientSecret: null,
        amountCents: 32500,
        currency: 'usd',
        discountApplied: false,
      }),
    })

    render(<NewProjectForm />)
    fillRequiredFields()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Checkout could not be initialized/,
    )
    expect(screen.queryByTestId('payment-step')).not.toBeInTheDocument()
  })
})
