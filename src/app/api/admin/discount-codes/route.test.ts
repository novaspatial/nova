import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { GET, POST } from './route'

const SAMPLE_CODE = {
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
}

function studioMock(codesChain = createChainMock()) {
  const profileChain = createChainMock({
    data: { id: 'studio-1', role: 'studio' },
    error: null,
  })
  return createSupabaseMock({
    user: { id: 'studio-1', email: 'studio@test.com' },
    fromMocks: { profiles: profileChain, discount_codes: codesChain },
  })
}

function clientMock() {
  const profileChain = createChainMock({
    data: { id: 'user-1', role: 'client' },
    error: null,
  })
  return createSupabaseMock({
    user: { id: 'user-1', email: 'client@test.com' },
    fromMocks: { profiles: profileChain },
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    code: 'welcome15',
    kind: 'percent',
    value: 15,
    newClientsOnly: true,
    ...overrides,
  }
}

describe('GET /api/admin/discount-codes', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-studio users', async () => {
    mockCreateClient.mockResolvedValue(clientMock())
    const res = await GET()
    expect(res.status).toBe(403)
  })

  test('lists codes for studio users', async () => {
    const codesChain = createChainMock({ data: [SAMPLE_CODE], error: null })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([SAMPLE_CODE])
    expect(codesChain.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    })
  })
})

describe('POST /api/admin/discount-codes', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 403 for non-studio users', async () => {
    mockCreateClient.mockResolvedValue(clientMock())
    const req = createMockRequest(validBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(403)
  })

  test.each([
    ['code too short', { code: 'AB' }],
    ['code with invalid characters', { code: 'BAD CODE!' }],
    ['missing kind', { kind: undefined }],
    ['unknown kind', { kind: 'bogo' }],
    ['non-integer value', { value: 12.5 }],
    ['zero value', { value: 0 }],
    ['percent above 100', { kind: 'percent', value: 150 }],
    ['both audience flags', { newClientsOnly: true, returningClientsOnly: true }],
    ['invalid usage limit', { usageLimit: 0 }],
    ['invalid expiry', { expiresAt: 'not-a-date' }],
  ])('returns 400 for %s', async (_label, overrides) => {
    mockCreateClient.mockResolvedValue(studioMock())
    const req = createMockRequest(validBody(overrides))
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
  })

  test('creates a code with normalized name and attribution', async () => {
    const codesChain = createChainMock()
    codesChain.single.mockResolvedValue({ data: SAMPLE_CODE, error: null })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const req = createMockRequest(
      validBody({
        code: '  welcome15 ',
        expiresAt: '2026-12-31',
        isPublic: false,
        singleUse: false,
        referralAttribution: '  Artist X referral  ',
      }),
    )
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(201)

    expect(codesChain.insert).toHaveBeenCalledWith({
      code: 'WELCOME15',
      kind: 'percent',
      value: 15,
      is_public: false,
      single_use: false,
      usage_limit: null,
      new_clients_only: true,
      returning_clients_only: false,
      referral_attribution: 'Artist X referral',
      expires_at: new Date('2026-12-31').toISOString(),
      created_by: 'studio-1',
    })
    const body = await res.json()
    expect(body).toEqual(SAMPLE_CODE)
  })

  test('returns 409 when the code name already exists', async () => {
    const codesChain = createChainMock()
    codesChain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const req = createMockRequest(validBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(409)
  })

  test('returns 500 on other insert errors', async () => {
    const codesChain = createChainMock()
    codesChain.single.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'db down' },
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const req = createMockRequest(validBody())
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(500)
  })
})
