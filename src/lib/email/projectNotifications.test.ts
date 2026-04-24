import { describe, test, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: (...args: unknown[]) => sendMock(...args) } },
  RESEND_FROM: 'Atmos <noreply@example.com>',
}))

import { sendProjectStatusEmail } from './projectNotifications'

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
      'https://example.com',
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
      'https://example.com',
    )

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
      'https://nova.test',
    )

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0][0]
    expect(payload.to).toBe('artist@example.com')
    expect(payload.subject).toContain('Night Drive')
    expect(payload.text).toContain('https://nova.test/portal/proj-1')
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
      'https://nova.test',
    )

    const payload = sendMock.mock.calls[0][0]
    expect(payload.subject).toMatch(/ready to listen/i)
    expect(payload.text).toContain('https://nova.test/portal/proj-1/listen')
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
      'https://nova.test',
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
        'https://nova.test',
      ),
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
