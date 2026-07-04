import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { DiscountCode } from '@/types/portal'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { DiscountCodesAdmin } from './DiscountCodesAdmin'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeCode(overrides: Partial<DiscountCode> = {}): DiscountCode {
  return {
    id: 'code-1',
    code: 'WELCOME15',
    kind: 'percent',
    value: 15,
    is_public: false,
    single_use: false,
    usage_limit: null,
    new_clients_only: true,
    returning_clients_only: false,
    referral_attribution: null,
    active: true,
    expires_at: null,
    created_by: 'studio-1',
    created_at: '2026-07-04T00:00:00.000Z',
    updated_at: '2026-07-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('DiscountCodesAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders the active-codes list with value, scope, and status', () => {
    render(
      <DiscountCodesAdmin
        initialCodes={[
          makeCode(),
          makeCode({
            id: 'code-2',
            code: 'ARTIST_X',
            kind: 'fixed',
            value: 5000,
            is_public: true,
            active: false,
            referral_attribution: 'Artist X referral',
          }),
        ]}
      />,
    )

    expect(screen.getByText('WELCOME15')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()

    expect(screen.getByText('ARTIST_X')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(screen.getByText(/Artist X referral/)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  test('renders the generation form fields', () => {
    render(<DiscountCodesAdmin initialCodes={[]} />)

    expect(screen.getByLabelText('Code name')).toBeInTheDocument()
    expect(screen.getByLabelText('Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Percent off')).toBeInTheDocument()
    expect(screen.getByLabelText(/Expiry/)).toBeInTheDocument()
    expect(screen.getByLabelText('Audience')).toBeInTheDocument()
    expect(screen.getByLabelText(/Referral attribution/)).toBeInTheDocument()
    expect(screen.getByText(/No codes yet/)).toBeInTheDocument()
  })

  test('creates a code and prepends it to the list', async () => {
    const created = makeCode({ id: 'code-9', code: 'SUMMER20', value: 20 })
    mockFetch.mockResolvedValue({ ok: true, json: async () => created })

    render(<DiscountCodesAdmin initialCodes={[]} />)
    fireEvent.change(screen.getByLabelText('Code name'), {
      target: { value: 'summer20' },
    })
    fireEvent.change(screen.getByLabelText('Percent off'), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }))

    await waitFor(() => {
      expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body).toMatchObject({
      code: 'SUMMER20',
      kind: 'percent',
      value: 20,
      isPublic: false,
      singleUse: false,
      newClientsOnly: false,
      returningClientsOnly: false,
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  test('shows the API error when creation fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Code "SUMMER20" already exists' }),
    })

    render(<DiscountCodesAdmin initialCodes={[]} />)
    fireEvent.change(screen.getByLabelText('Code name'), {
      target: { value: 'SUMMER20' },
    })
    fireEvent.change(screen.getByLabelText('Percent off'), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code "SUMMER20" already exists',
    )
  })

  test('deactivates a code from the list', async () => {
    const code = makeCode()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...code, active: false }),
    })

    render(<DiscountCodesAdmin initialCodes={[code]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(screen.getByText('disabled')).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/discount-codes/code-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})
