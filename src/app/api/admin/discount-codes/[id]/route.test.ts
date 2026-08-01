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

import { DELETE, PATCH } from './route'

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

describe('DELETE /api/admin/discount-codes/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  function deleteRequest() {
    return createMockRequest(undefined, { method: 'DELETE' }) as NextRequest
  }

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

    const res = await DELETE(deleteRequest(), makeParams('code-1'))
    expect(res.status).toBe(403)
  })

  test('hard-deletes a disabled code', async () => {
    const codesChain = createChainMock()
    codesChain.maybeSingle.mockResolvedValueOnce({
      data: { id: 'code-1' },
      error: null,
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const res = await DELETE(deleteRequest(), makeParams('code-1'))
    expect(res.status).toBe(200)

    // The delete is conditional on the row already being disabled.
    expect(codesChain.delete).toHaveBeenCalled()
    expect(codesChain.eq).toHaveBeenCalledWith('id', 'code-1')
    expect(codesChain.eq).toHaveBeenCalledWith('active', false)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('returns 400 when the code is still active', async () => {
    const codesChain = createChainMock()
    codesChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // conditional delete misses
      .mockResolvedValueOnce({ data: { id: 'code-1' }, error: null }) // row exists
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const res = await DELETE(deleteRequest(), makeParams('code-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Deactivate/)
  })

  test('returns 404 when the code does not exist', async () => {
    const codesChain = createChainMock()
    codesChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const res = await DELETE(deleteRequest(), makeParams('missing'))
    expect(res.status).toBe(404)
  })

  test('returns 500 when the delete fails', async () => {
    const codesChain = createChainMock()
    codesChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    })
    mockCreateClient.mockResolvedValue(studioMock(codesChain))

    const res = await DELETE(deleteRequest(), makeParams('code-1'))
    expect(res.status).toBe(500)
  })
})
