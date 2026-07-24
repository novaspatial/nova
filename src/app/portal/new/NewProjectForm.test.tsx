import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { FileUploadItem } from '@/types/portal'
import { TERMS_VERSION } from '@/lib/legal/terms'
import { WELCOME_COUPON_CODE } from '@/lib/portal/orderDiscount'
import { WELCOME_DISCOUNT_PCT } from '@/lib/stripe/pricing'

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

function validateOk(
  couponCode: string,
  code: { kind: 'percent' | 'fixed'; value: number; scope: 'public' | 'private' },
) {
  return { ok: true, json: async () => ({ couponCode, code }) }
}

function applyCode(code: string) {
  fireEvent.change(screen.getByLabelText(/Discount Code/), {
    target: { value: code },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
}

const checkoutResponse = {
  ok: true,
  json: async () => ({
    projectId: 'proj-1',
    clientSecret: 'cs_test',
    amountCents: 29250,
    currency: 'usd',
    discountApplied: false,
    appliedCouponCode: 'SUMMER10',
    breakdown: {
      currency: 'usd',
      song_count: 1,
      list_unit_cents: 32500,
      list_total_cents: 32500,
      bulk_discount_cents: 0,
      code_discount_cents: 3250,
      add_ons_cents: 0,
      subtotal_cents: 29250,
      tax_cents: 0,
      tax_rate_pct: 0,
      tax_label: null,
      total_cents: 29250,
    },
  }),
}

function fillRequiredFields(songCount = '1') {
  fireEvent.change(screen.getByLabelText('Project Title'), {
    target: { value: 'My Album' },
  })
  fireEvent.change(screen.getByLabelText('Number of Songs'), {
    target: { value: songCount },
  })
  fireEvent.change(screen.getByLabelText('Billing Country'), {
    target: { value: 'US' },
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
          tax_rate_pct: 0,
          tax_label: null,
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
      // Untouched checkboxes submit [] — never undefined/null (#19).
      addOns: [],
      referenceTracks: 'Song X — Artist Y',
      notes: null,
      billingCountry: 'US',
      billingProvince: null,
      termsAcceptedVersion: TERMS_VERSION,
      code: null,
    })
  })

  test('add-on checkboxes update the live quote and ride the POST body', async () => {
    mockFetch.mockResolvedValue(checkoutResponse)

    render(<NewProjectForm />)
    const quote = screen.getByTestId('live-quote')
    expect(quote).not.toHaveTextContent('Add-ons')

    // 1 song 325 + 50 + 149 = 524.
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Extra revision round/ }),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /48-hour rush/ }))
    expect(quote).toHaveTextContent('Add-ons')
    expect(quote).toHaveTextContent('$199')
    expect(quote).toHaveTextContent('$524')

    fillRequiredFields()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('payment-step')).toBeInTheDocument()
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    // Click order — the server re-validates and canonicalizes.
    expect(body.addOns).toEqual(['extra_revision', 'rush_48h'])
  })

  test('unchecking an add-on removes it from the quote', () => {
    render(<NewProjectForm />)
    const rush = screen.getByRole('checkbox', { name: /48-hour rush/ })
    const quote = screen.getByTestId('live-quote')

    fireEvent.click(rush)
    expect(quote).toHaveTextContent('$474')

    fireEvent.click(rush)
    expect(quote).not.toHaveTextContent('Add-ons')
    expect(quote).toHaveTextContent('$325')
  })

  test('reveals the province select for Canada and taxes the live quote', () => {
    render(<NewProjectForm />)

    expect(
      screen.queryByLabelText('Province / Territory'),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Billing Country'), {
      target: { value: 'CA' },
    })
    const provinceSelect = screen.getByLabelText('Province / Territory')
    expect(provinceSelect).toBeRequired()

    // Country alone isn't a complete location — still untaxed. (The footnote
    // always mentions "GST/HST", so assert on the tax-row label.)
    const quote = screen.getByTestId('live-quote')
    expect(quote).not.toHaveTextContent('HST (13%)')

    fireEvent.change(provinceSelect, { target: { value: 'ON' } })
    expect(quote).toHaveTextContent('HST (13%)')
    expect(quote).toHaveTextContent('$42.25')
    expect(quote).toHaveTextContent('$367.25')

    // Switching away from Canada drops the tax line and the province field.
    fireEvent.change(screen.getByLabelText('Billing Country'), {
      target: { value: 'US' },
    })
    expect(quote).not.toHaveTextContent('HST (13%)')
    expect(quote).toHaveTextContent('$325')
    expect(
      screen.queryByLabelText('Province / Territory'),
    ).not.toBeInTheDocument()
  })

  test('blocks submit until a billing country is selected', async () => {
    render(<NewProjectForm />)
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'My Album' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add stems' }))
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Project & Upload' })
        .closest('form') as HTMLFormElement,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Select a billing country',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('blocks submit until the terms are accepted', async () => {
    render(<NewProjectForm />)
    // Fill everything EXCEPT the consent checkbox.
    fireEvent.change(screen.getByLabelText('Project Title'), {
      target: { value: 'My Album' },
    })
    fireEvent.change(screen.getByLabelText('Billing Country'), {
      target: { value: 'US' },
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

  test('applies a code and the live quote shows the discount', async () => {
    mockFetch.mockResolvedValue(
      validateOk('SUMMER10', { kind: 'percent', value: 10, scope: 'public' }),
    )

    render(<NewProjectForm />)
    applyCode('SUMMER10')

    await screen.findByText(/SUMMER10 applied/)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/portal/discount-codes/validate',
      expect.objectContaining({ method: 'POST' }),
    )

    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('Discount · SUMMER10')
    expect(quote).toHaveTextContent('−$32.50')
    expect(quote).toHaveTextContent('$292.50')
  })

  test('a private code suppresses the album discount in the live preview', async () => {
    mockFetch.mockResolvedValue(
      validateOk('VIP20', { kind: 'percent', value: 20, scope: 'private' }),
    )

    render(<NewProjectForm />)
    fireEvent.change(screen.getByLabelText('Number of Songs'), {
      target: { value: '5' },
    })
    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('Album discount')

    applyCode('VIP20')
    await screen.findByText(/VIP20 applied/)

    expect(quote).not.toHaveTextContent('Album discount')
    expect(quote).toHaveTextContent('Discount · VIP20')
    expect(quote).toHaveTextContent('−$325')
    expect(quote).toHaveTextContent('$1,300')
  })

  test('shows the rejection message and keeps the quote undiscounted', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "That code isn't valid." }),
    })

    render(<NewProjectForm />)
    applyCode('BOGUS')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That code isn't valid.",
    )
    const quote = screen.getByTestId('live-quote')
    expect(quote).not.toHaveTextContent('Discount ·')
    expect(quote).toHaveTextContent('$325')
  })

  test('editing the code input clears the applied state', async () => {
    mockFetch.mockResolvedValue(
      validateOk('SUMMER10', { kind: 'percent', value: 10, scope: 'public' }),
    )

    render(<NewProjectForm />)
    applyCode('SUMMER10')
    await screen.findByText(/SUMMER10 applied/)

    fireEvent.change(screen.getByLabelText(/Discount Code/), {
      target: { value: 'SUMMER1' },
    })

    expect(screen.queryByText(/SUMMER10 applied/)).not.toBeInTheDocument()
    const quote = screen.getByTestId('live-quote')
    expect(quote).not.toHaveTextContent('Discount ·')
    expect(quote).toHaveTextContent('$325')
  })

  test('submits the applied couponCode', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('/discount-codes/validate')
        ? validateOk('SUMMER10', { kind: 'percent', value: 10, scope: 'public' })
        : checkoutResponse,
    )

    render(<NewProjectForm />)
    fillRequiredFields()
    applyCode('SUMMER10')
    await screen.findByText(/SUMMER10 applied/)

    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('payment-step')).toBeInTheDocument()
    })

    const checkoutCall = mockFetch.mock.calls.find(
      ([url]) => url === '/api/portal/projects/checkout',
    )
    expect(checkoutCall).toBeDefined()
    const body = JSON.parse(checkoutCall![1].body as string)
    expect(body.code).toBe('SUMMER10')
  })

  test('submits the normalized typed-but-unapplied code', async () => {
    mockFetch.mockResolvedValue(checkoutResponse)

    render(<NewProjectForm />)
    fillRequiredFields()
    fireEvent.change(screen.getByLabelText(/Discount Code/), {
      target: { value: 'summer10' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('payment-step')).toBeInTheDocument()
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.code).toBe('SUMMER10')
  })

  test('renders the welcome hint from the shared constants', () => {
    render(<NewProjectForm />)

    expect(
      screen.getByText(
        `New here? Use code ${WELCOME_COUPON_CODE} for ${WELCOME_DISCOUNT_PCT}% off your first mix.`,
      ),
    ).toBeInTheDocument()
  })

  // Calculator deep-link prefill (#30) — parsed server-side in page.tsx.
  test('initialSongCount seeds the stepper and the live quote', () => {
    render(<NewProjectForm initialSongCount={4} />)

    expect(screen.getByLabelText('Number of Songs')).toHaveValue(4)
    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('4 songs × $325')
    expect(quote).toHaveTextContent('Album discount')
  })

  test('initialAddOns seeds the checkboxes and the live quote', () => {
    render(<NewProjectForm initialAddOns={['rush_48h']} />)

    expect(
      screen.getByRole('checkbox', { name: /48-hour rush/ }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: /Extra revision round/ }),
    ).not.toBeChecked()
    const quote = screen.getByTestId('live-quote')
    expect(quote).toHaveTextContent('Add-ons')
    expect(quote).toHaveTextContent('$149')
    expect(quote).toHaveTextContent('$474')
  })

  test('initialCode prefills the input and submits without Apply', async () => {
    mockFetch.mockResolvedValue(checkoutResponse)

    render(<NewProjectForm initialCode={WELCOME_COUPON_CODE} />)
    expect(screen.getByLabelText(/Discount Code/)).toHaveValue(
      WELCOME_COUPON_CODE,
    )

    fillRequiredFields()
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Project & Upload' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('payment-step')).toBeInTheDocument()
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.code).toBe(WELCOME_COUPON_CODE)
  })
})
