import { describe, test, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: (...args: unknown[]) => sendMock(...args) } },
  RESEND_FROM: 'Atmos <noreply@example.com>',
}))

import { sendProjectStatusEmail } from './projectNotifications'
import { SITE_URL } from '@/lib/site'

type SingleResult = {
  data: {
    title: string
    owner: { email: string | null; display_name: string | null } | null
  } | null
  error: { message: string } | null
}

function makeSupabase(single: SingleResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(single),
  }
  return {
    from: vi.fn(() => chain),
  } as unknown as Parameters<typeof sendProjectStatusEmail>[0]
}

describe('sendProjectStatusEmail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  test('short-circuits without sending for non-notifiable statuses', async () => {
    const supabase = makeSupabase({
      data: { title: 'T', owner: { email: 'a@b.co', display_name: null } },
      error: null,
    })

    await sendProjectStatusEmail(
      supabase,
      'proj-1',
      'pending_payment',
    )

    expect(sendMock).not.toHaveBeenCalled()
  })

  test('does not send when the project/owner lookup has no email', async () => {
    const supabase = makeSupabase({
      data: { title: 'T', owner: { email: null, display_name: 'X' } },
      error: null,
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendProjectStatusEmail(
      supabase,
      'proj-1',
      'in_review',
    )

    expect(sendMock).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('swallows a throwing Resend send — the caller already committed', async () => {
    const supabase = makeSupabase({
      data: { title: 'T', owner: { email: 'a@b.co', display_name: null } },
      error: null,
    })
    sendMock.mockRejectedValue(new Error('Resend is down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendProjectStatusEmail(supabase, 'proj-1', 'review'),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('swallows a throwing project lookup', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('Supabase unreachable')),
    }
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as Parameters<typeof sendProjectStatusEmail>[0]
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendProjectStatusEmail(supabase, 'proj-1', 'review'),
    ).resolves.toBeUndefined()

    expect(sendMock).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('sends the "in_review" email with project title in the subject', async () => {
    const supabase = makeSupabase({
      data: {
        title: 'Night Drive',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })

    await sendProjectStatusEmail(
      supabase,
      'proj-1',
      'in_review',
    )

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0][0]
    expect(payload.to).toBe('artist@example.com')
    expect(payload.subject).toContain('Night Drive')
    expect(payload.text).toContain(`${SITE_URL}/portal/proj-1`)
  })

  test('"review" email links to the /listen subpage', async () => {
    const supabase = makeSupabase({
      data: {
        title: 'Night Drive',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })

    await sendProjectStatusEmail(
      supabase,
      'proj-1',
      'review',
    )

    const payload = sendMock.mock.calls[0][0]
    expect(payload.subject).toMatch(/ready to listen/i)
    expect(payload.text).toContain(`${SITE_URL}/portal/proj-1/listen`)
    // The CTA is the only link that matters here, and it must point at /listen.
    expect(payload.html).toContain(
      `href="${SITE_URL}/portal/proj-1/listen"`,
    )
    expect(payload.html).toContain('Listen to your mix')
  })

  test('sends both a text and an HTML part, carrying the same link', async () => {
    const supabase = makeSupabase({
      data: {
        title: 'Night Drive',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })

    await sendProjectStatusEmail(supabase, 'proj-1', 'mixing')

    const payload = sendMock.mock.calls[0][0]
    // text/plain stays the multipart alternative — dropping it would hurt
    // deliverability and strand clients that refuse HTML.
    expect(payload.text).toContain(`${SITE_URL}/portal/proj-1`)
    expect(payload.html).toContain(`href="${SITE_URL}/portal/proj-1"`)
    expect(payload.html).toContain('<!DOCTYPE html>')
    expect(payload.html).toContain('Mixing has started')
  })

  test('escapes a project title containing markup', async () => {
    const supabase = makeSupabase({
      data: {
        title: '<img src=x onerror=alert(1)>',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })

    await sendProjectStatusEmail(supabase, 'proj-1', 'delivered')

    const payload = sendMock.mock.calls[0][0]
    expect(payload.html).not.toContain('<img src=x')
    expect(payload.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  test('"delivered" email is sent for the delivered status', async () => {
    const supabase = makeSupabase({
      data: {
        title: 'Night Drive',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })

    await sendProjectStatusEmail(
      supabase,
      'proj-1',
      'delivered',
    )

    const payload = sendMock.mock.calls[0][0]
    expect(payload.subject).toMatch(/delivered/i)
    expect(payload.text).toContain('Night Drive')
  })

  test('resend send errors are logged but do not throw', async () => {
    const supabase = makeSupabase({
      data: {
        title: 'Night Drive',
        owner: { email: 'artist@example.com', display_name: 'A' },
      },
      error: null,
    })
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'resend down' },
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      sendProjectStatusEmail(
        supabase,
        'proj-1',
        'in_review',
        ),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
