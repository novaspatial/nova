import { describe, test, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: (...args: unknown[]) => sendMock(...args) } },
  RESEND_FROM: 'Atmos <noreply@example.com>',
}))

import { sendOrderConfirmationEmail } from './orderConfirmation'
import { SITE_URL } from '@/lib/site'

type Row = Record<string, unknown>

function receiptRow(overrides: Row = {}): Row {
  return {
    title: 'Night Drive',
    amount_cents: 124700,
    currency: 'usd',
    song_count: 4,
    subtotal_cents: 110400,
    tax_cents: 14300,
    buyer_country: 'CA',
    buyer_province: 'ON',
    applied_coupon_code: 'SUMMER10',
    add_ons: ['extra_revision', 'rush_48h'],
    owner: { email: 'artist@example.com' },
    ...overrides,
  }
}

function makeSupabase(single: { data: Row | null; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(single),
  }
  return {
    from: vi.fn(() => chain),
  } as unknown as Parameters<typeof sendOrderConfirmationEmail>[0]
}

describe('sendOrderConfirmationEmail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  test('sends the full receipt with every persisted line', async () => {
    const supabase = makeSupabase({ data: receiptRow(), error: null })

    await sendOrderConfirmationEmail(supabase, 'proj-1')

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0][0]
    expect(payload.to).toBe('artist@example.com')
    expect(payload.from).toBe('Atmos <noreply@example.com>')
    expect(payload.subject).toBe('Order confirmed — "Night Drive"')
    expect(payload.text).toContain('4 songs — Dolby Atmos mix')
    expect(payload.text).toContain(
      'Add-ons: Extra revision round, 48-hour rush',
    )
    expect(payload.text).toContain('Discount code SUMMER10 applied')
    expect(payload.text).toContain('Subtotal: $1,104')
    expect(payload.text).toContain('HST (13%): $143')
    expect(payload.text).toContain('Total: $1,247 USD')
    expect(payload.text).toContain(`${SITE_URL}/portal/proj-1`)
    expect(payload.text).toContain(`${SITE_URL}/terms`)
    expect(payload.text).toContain('estimated delivery date')
  })

  test('omits the coupon, tax, and add-on lines when the order has none', async () => {
    const supabase = makeSupabase({
      data: receiptRow({
        song_count: 1,
        subtotal_cents: 32500,
        amount_cents: 32500,
        tax_cents: 0,
        buyer_country: 'US',
        buyer_province: null,
        applied_coupon_code: null,
        add_ons: [],
      }),
      error: null,
    })

    await sendOrderConfirmationEmail(supabase, 'proj-1')

    const payload = sendMock.mock.calls[0][0]
    expect(payload.text).toContain('1 song — Dolby Atmos mix')
    expect(payload.text).not.toContain('Discount code')
    expect(payload.text).not.toContain('Add-ons:')
    expect(payload.text).not.toMatch(/GST|HST|Tax:/)
    expect(payload.text).toContain('Total: $325 USD')
  })

  test('a CA order without a province falls back to the 5% GST label', async () => {
    const supabase = makeSupabase({
      data: receiptRow({ buyer_province: null, tax_cents: 5520 }),
      error: null,
    })

    await sendOrderConfirmationEmail(supabase, 'proj-1')

    expect(sendMock.mock.calls[0][0].text).toContain('GST (5%): $55.20')
  })

  test('does not send when the order lookup fails', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'boom' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendOrderConfirmationEmail(supabase, 'proj-1')

    expect(sendMock).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('does not send when the owner has no email', async () => {
    const supabase = makeSupabase({
      data: receiptRow({ owner: { email: null } }),
      error: null,
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendOrderConfirmationEmail(supabase, 'proj-1')

    expect(sendMock).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('resend errors are logged but never thrown', async () => {
    const supabase = makeSupabase({ data: receiptRow(), error: null })
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'resend down' },
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendOrderConfirmationEmail(supabase, 'proj-1'),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('a thrown transport failure is swallowed, not propagated', async () => {
    const supabase = makeSupabase({ data: receiptRow(), error: null })
    sendMock.mockRejectedValueOnce(new Error('network down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendOrderConfirmationEmail(supabase, 'proj-1'),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
