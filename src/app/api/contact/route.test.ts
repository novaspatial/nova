import { createSupabaseMock, createChainMock } from '@/test/helpers/supabaseMock'

const mockCreateServiceClient = vi.fn()
vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

const mockSend = vi.fn()
vi.mock('@/lib/resend', () => ({
  resend: { emails: { send: (...args: unknown[]) => mockSend(...args) } },
  RESEND_FROM: 'NOVA <noreply@example.com>',
}))

import { POST } from './route'

const body = {
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'Atmos mix',
  message: 'Four songs, stems ready.',
}

function contactRequest(payload: unknown, headers: Record<string, string> = {}) {
  return new Request('https://nova-spatial.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
}

function serviceMock({ count = 0 }: { count?: number } = {}) {
  const inquiries = createChainMock({ data: null, error: null })
  inquiries.or = vi.fn().mockResolvedValue({ count, error: null })
  const supabase = createSupabaseMock({
    fromMocks: { contact_inquiries: inquiries },
  })
  mockCreateServiceClient.mockReturnValue(supabase)
  return inquiries
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    process.env.CONTACT_INBOX_TO = 'studio@example.com'
  })

  test('stores the inquiry with a hashed IP and emails the studio', async () => {
    const inquiries = serviceMock()

    const res = await POST(
      contactRequest(body, { 'x-forwarded-for': '203.0.113.7' }),
    )

    expect(res.status).toBe(200)
    expect(inquiries.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Atmos mix',
        ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    )
    // The submitter never controls the Subject header (#51).
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New inquiry from Ada',
        replyTo: 'ada@example.com',
      }),
    )
  })

  test('returns 400 instead of 500 for a malformed body', async () => {
    serviceMock()
    const res = await POST(contactRequest('{not json'))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  test('returns 400 for an invalid email', async () => {
    const inquiries = serviceMock()
    const res = await POST(contactRequest({ ...body, email: 'nope' }))
    expect(res.status).toBe(400)
    expect(inquiries.insert).not.toHaveBeenCalled()
  })

  test('returns 400 for an over-long message', async () => {
    const inquiries = serviceMock()
    const res = await POST(
      contactRequest({ ...body, message: 'x'.repeat(5001) }),
    )
    expect(res.status).toBe(400)
    expect(inquiries.insert).not.toHaveBeenCalled()
  })

  test('returns 429 once the sender is over the window limit', async () => {
    const inquiries = serviceMock({ count: 3 })
    const res = await POST(contactRequest(body))
    expect(res.status).toBe(429)
    expect(inquiries.insert).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  test('returns 503 when the service client is unavailable', async () => {
    mockCreateServiceClient.mockImplementation(() => {
      throw new Error('missing key')
    })
    const res = await POST(contactRequest(body))
    expect(res.status).toBe(503)
  })
})
