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

import { PATCH } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
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

describe('PATCH /api/admin/discount-codes/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 403 for non-studio users', async () => {
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({
        user: { id: 'user-1', email: 'client@test.com' },
        fromMocks: { profiles: profileChain },
      }),
    )

    const req = createMockRequest({ active: false }, { method: 'PATCH' })
    const res = await PATCH(req as NextRequest, makeParams('code-1'))
    expect(res.status).toBe(403)
  })

  test('returns 400 when active is missing or not boolean', async () => {
    mockCreateClient.mockResolvedValue(studioMock())
    const req = createMockRequest({ active: 'yes' }, { method: 'PATCH' })
    const res = await PATCH(req as NextRequest, makeParams('code-1'))
    expect(res.status).toBe(400)
  })

  test('deactivates a code', async () => {
    const codesChain = createChainMock()
    codesChain.single.mockResolvedValue({
      data: { id: 'code-1', active: false },
      error: null,
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const req = createMockRequest({ active: false }, { method: 'PATCH' })
    const res = await PATCH(req as NextRequest, makeParams('code-1'))
    expect(res.status).toBe(200)

    expect(codesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    )
    expect(codesChain.eq).toHaveBeenCalledWith('id', 'code-1')
    const body = await res.json()
    expect(body.active).toBe(false)
  })

  test('returns 404 when the code does not exist', async () => {
    const codesChain = createChainMock()
    codesChain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const req = createMockRequest({ active: false }, { method: 'PATCH' })
    const res = await PATCH(req as NextRequest, makeParams('missing'))
    expect(res.status).toBe(404)
  })
})
