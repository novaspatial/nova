import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
    active: true,
    expires_at: null,
    reserved_count: 0,
    redeemed_count: 0,
    allow_below_floor: false,
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
      allowBelowFloor: false,
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  test('marks below-floor codes and shows redemption counts in the list', () => {
    render(
      <DiscountCodesAdmin
        initialCodes={[
          makeCode({
            allow_below_floor: true,
            single_use: true,
            redeemed_count: 1,
          }),
          makeCode({
            id: 'code-2',
            code: 'ARTIST_X',
            usage_limit: 5,
            redeemed_count: 2,
          }),
        ]}
      />,
    )

    // single_use dominates: capacity reads 1, not the absent usage_limit.
    expect(screen.getByText(/below floor/)).toBeInTheDocument()
    expect(screen.getByText(/redeemed 1\/1/)).toBeInTheDocument()
    expect(screen.getByText(/redeemed 2\/5/)).toBeInTheDocument()
  })

  test('the below-floor checkbox is private-only and clears when Public is checked', () => {
    render(<DiscountCodesAdmin initialCodes={[]} />)

    const belowFloor = screen.getByLabelText(/below the \$225\/song floor/)
    fireEvent.click(belowFloor)
    expect(belowFloor).toBeChecked()

    // Going public hides the override and drops it from the payload state.
    fireEvent.click(screen.getByLabelText(/Public \(stacks/))
    expect(
      screen.queryByLabelText(/below the \$225\/song floor/),
    ).not.toBeInTheDocument()

    // Back to private: the override must have been cleared, not remembered.
    fireEvent.click(screen.getByLabelText(/Public \(stacks/))
    expect(screen.getByLabelText(/below the \$225\/song floor/)).not.toBeChecked()
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

  test('paginates the list only past 5 codes', () => {
    render(
      <DiscountCodesAdmin
        initialCodes={Array.from({ length: 7 }, (_, i) =>
          makeCode({ id: `code-${i}`, code: `CODE${i}` }),
        )}
      />,
    )

    expect(screen.getByText('CODE0')).toBeInTheDocument()
    expect(screen.getByText('CODE4')).toBeInTheDocument()
    expect(screen.queryByText('CODE5')).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('CODE5')).toBeInTheDocument()
    expect(screen.getByText('CODE6')).toBeInTheDocument()
    expect(screen.queryByText('CODE0')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  test('hides pagination at 5 or fewer codes', () => {
    render(
      <DiscountCodesAdmin
        initialCodes={Array.from({ length: 5 }, (_, i) =>
          makeCode({ id: `code-${i}`, code: `CODE${i}` }),
        )}
      />,
    )

    expect(screen.getByText('CODE4')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next page' }),
    ).not.toBeInTheDocument()
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

  test('offers Delete only on disabled codes and deletes after confirm', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    render(
      <DiscountCodesAdmin
        initialCodes={[
          makeCode(),
          makeCode({ id: 'code-2', code: 'OLD10', active: false }),
        ]}
      />,
    )

    // Only the disabled row gets a Delete action.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('OLD10')

    fireEvent.click(screen.getByRole('button', { name: 'Delete code' }))
    await waitFor(() => {
      expect(screen.queryByText('OLD10')).not.toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/discount-codes/code-2', {
      method: 'DELETE',
    })
    expect(screen.getByText('WELCOME15')).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
  })

  test('cancelling the delete dialog keeps the code and calls nothing', () => {
    render(
      <DiscountCodesAdmin initialCodes={[makeCode({ active: false })]} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockFetch).not.toHaveBeenCalled()
    // Scoped to the list: the dismissed dialog also mentions the code.
    expect(
      within(screen.getByRole('list')).getByText('WELCOME15'),
    ).toBeInTheDocument()
  })

  test('keeps the code and surfaces the error when deletion fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Deactivate a code before deleting it' }),
    })

    render(
      <DiscountCodesAdmin initialCodes={[makeCode({ active: false })]} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete code' }))

    expect(
      await screen.findByText('Deactivate a code before deleting it'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list')).getByText('WELCOME15'),
    ).toBeInTheDocument()
  })
})
