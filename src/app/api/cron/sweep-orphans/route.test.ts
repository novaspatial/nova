import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'
import type { NextRequest } from 'next/server'

import { createMockRequest } from '@/test/helpers/supabaseMock'
import { GET } from './route'
import { sweepOrphanedUploads } from '@/lib/portal/orphanSweep'
import { createServiceClient } from '@/lib/supabase/supabaseService'

vi.mock('@/lib/portal/orphanSweep', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/portal/orphanSweep')>()),
  sweepOrphanedUploads: vi.fn(),
}))

vi.mock('@/lib/supabase/supabaseService', () => ({
  createServiceClient: vi.fn(),
}))

const mockSweep = vi.mocked(sweepOrphanedUploads)
const mockService = vi.mocked(createServiceClient)

const ORIGINAL_SECRET = process.env.CRON_SECRET

const cronRequest = (auth?: string) =>
  createMockRequest(undefined, {
    headers: auth ? { authorization: auth } : {},
  }) as NextRequest

describe('GET /api/cron/sweep-orphans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    mockService.mockReturnValue({} as ReturnType<typeof createServiceClient>)
    mockSweep.mockResolvedValue({
      pendingRowsRemoved: 0,
      orphanObjectsRemoved: 0,
      failures: [],
      mayHaveMore: false,
    })
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  test('fails closed with 500 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET

    const res = await GET(cronRequest('Bearer anything'))

    expect(res.status).toBe(500)
    expect(mockSweep).not.toHaveBeenCalled()
  })

  test('rejects a missing or wrong bearer token with 401', async () => {
    const missing = await GET(cronRequest())
    expect(missing.status).toBe(401)

    const wrong = await GET(cronRequest('Bearer not-the-secret'))
    expect(wrong.status).toBe(401)

    expect(mockSweep).not.toHaveBeenCalled()
  })

  test('returns 500 when the service client is not configured', async () => {
    mockService.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(500)
    expect(mockSweep).not.toHaveBeenCalled()
  })

  test('runs the sweep on the service client and reports counts', async () => {
    const service = { tag: 'service' } as unknown as ReturnType<
      typeof createServiceClient
    >
    mockService.mockReturnValue(service)
    mockSweep.mockResolvedValue({
      pendingRowsRemoved: 2,
      orphanObjectsRemoved: 3,
      failures: [{ target: 'u1/p1/a.wav', error: 'storage down' }],
      mayHaveMore: true,
    })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      pendingRowsRemoved: 2,
      orphanObjectsRemoved: 3,
      failed: 1,
      mayHaveMore: true,
    })
    expect(mockSweep).toHaveBeenCalledWith(service)
  })

  test('returns 500 when the sweep itself fails', async () => {
    mockSweep.mockResolvedValue({ error: 'db unreachable' })

    const res = await GET(cronRequest('Bearer cron-secret'))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'db unreachable' })
  })
})
