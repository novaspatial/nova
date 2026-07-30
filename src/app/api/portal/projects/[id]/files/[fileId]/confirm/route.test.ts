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

import { POST } from './route'

function makeParams(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

describe('POST /api/portal/projects/[id]/files/[fileId]/confirm', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1', 'file-1'))
    expect(res.status).toBe(401)
  })

  test('returns 404 when file not found', async () => {
    const filesChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1', 'file-1'))
    expect(res.status).toBe(404)
  })

  test('returns 200 and updates file status on success', async () => {
    const filesChain = createChainMock({
      data: { id: 'file-1', uploaded_by: 'user-1', upload_status: 'pending' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1', 'file-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('uploaded')
    expect(filesChain.update).toHaveBeenCalledWith({ upload_status: 'uploaded' })
    expect(filesChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    // The CAS keeps confirm on the pending -> uploaded edge (#59).
    expect(filesChain.eq).toHaveBeenCalledWith('upload_status', 'pending')
  })

  test('refuses to confirm someone else\'s upload (#59)', async () => {
    const filesChain = createChainMock({
      data: { id: 'file-1', uploaded_by: 'other-user', upload_status: 'pending' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1', 'file-1'))

    expect(res.status).toBe(403)
    expect(filesChain.update).not.toHaveBeenCalled()
  })

  test('re-confirming an uploaded row is a no-op', async () => {
    const filesChain = createChainMock({
      data: { id: 'file-1', uploaded_by: 'user-1', upload_status: 'uploaded' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1', 'file-1'))

    expect(res.status).toBe(200)
    expect(filesChain.update).not.toHaveBeenCalled()
  })
})
