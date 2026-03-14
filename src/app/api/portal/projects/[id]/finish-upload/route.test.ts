import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined)
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { POST } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/portal/projects/[id]/finish-upload', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      createSupabaseMock({ user: null }),
    )

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(401)
  })

  test('returns 500 when update fails', async () => {
    const projectsChain = createChainMock({ 
      data: null, 
      error: { message: 'Database error' } 
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).toBe('Failed to update project status')
    expect(mockConsoleError).toHaveBeenCalled()
  })

  test('returns 200 on successful update', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const req = createMockRequest()
    const res = await POST(req as NextRequest, makeParams('proj-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(projectsChain.update).toHaveBeenCalledWith({ status: 'mixing' })
    expect(projectsChain.eq).toHaveBeenCalledWith('id', 'proj-1')
    expect(projectsChain.eq).toHaveBeenCalledWith('owner_id', 'user-1')
  })
})
