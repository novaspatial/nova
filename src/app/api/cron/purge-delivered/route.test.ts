import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'
import type { NextRequest } from 'next/server'

import { createMockRequest } from '@/test/helpers/supabaseMock'
import { GET } from './route'
import { purgeExpiredDeliveredProjects } from '@/lib/portal/retentionPurge'
import { createServiceClient } from '@/lib/supabase/supabaseService'

vi.mock('@/lib/portal/retentionPurge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/portal/retentionPurge')>()),
  purgeExpiredDeliveredProjects: vi.fn(),
}))

vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: vi.fn(),
}))

const mockPurge = vi.mocked(purgeExpiredDeliveredProjects)
const mockService = vi.mocked(createServiceClient)

const ORIGINAL_SECRET = process.env.CRON_SECRET

const cronRequest = (auth?: string) =>
  createMockRequest(undefined, {
    headers: auth ? { authorization: auth } : {},
  }) as NextRequest

describe('GET /api/cron/purge-delivered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    mockService.mockReturnValue({} as ReturnType<typeof createServiceClient>)
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  test('fails closed with 500 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET

    const res = await GET(cronRequest('Bearer anything'))

    expect(res.status).toBe(500)
    expect(mockPurge).not.toHaveBeenCalled()
  })

  test('rejects a missing or wrong bearer token with 401', async () => {
    const missing = await GET(cronRequest())
    expect(missing.status).toBe(401)

    const wrong = await GET(cronRequest('Bearer not-the-secret'))
    expect(wrong.status).toBe(401)

    expect(mockPurge).not.toHaveBeenCalled()
  })

  test('returns 500 when the service client is not configured', async () => {
    mockService.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(500)
    expect(mockPurge).not.toHaveBeenCalled()
  })

  test('runs the purge on the service client and reports counts', async () => {
    const service = { tag: 'service' } as unknown as ReturnType<
      typeof createServiceClient
    >
    mockService.mockReturnValue(service)
    mockPurge.mockResolvedValue({
      purged: ['proj-1', 'proj-2'],
      failures: [{ projectId: 'proj-3', error: 'storage down' }],
      mayHaveMore: false,
    })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      purged: 2,
      failed: 1,
      mayHaveMore: false,
    })
    expect(mockPurge).toHaveBeenCalledWith(service)
  })

  test('returns 500 when the sweep itself fails', async () => {
    mockPurge.mockResolvedValue({ error: 'db unreachable' })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'db unreachable' })
  })
})
