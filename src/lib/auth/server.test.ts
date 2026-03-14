import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createChainMock,
  createSupabaseMock,
} from '@/test/helpers/supabaseMock'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`)
})
const mockNotFound = vi.fn(() => {
  throw new Error('NOT_FOUND')
})

vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  notFound: (...args: unknown[]) => mockNotFound(...args),
}))

import {
  getAuthProfile,
  getProjectOrApiNotFound,
  getProjectOrNotFound,
  requireApiProfile,
  requireApiStudioUser,
  requireApiUser,
  requirePageProfile,
  requirePageUser,
} from './server'

describe('auth server helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('requireApiUser returns 401 when client is unavailable', async () => {
    mockCreateClient.mockResolvedValue(null)

    const result = await requireApiUser()

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Unauthorized',
      })
    }
  })

  test('requireApiUser returns 401 when auth lookup throws', async () => {
    const supabase = createSupabaseMock()
    supabase.auth.getUser = vi.fn().mockRejectedValue(new Error('network down'))
    mockCreateClient.mockResolvedValue(supabase)

    const result = await requireApiUser()

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
    }
  })

  test('requireApiStudioUser returns 403 for non-studio users', async () => {
    const profilesChain = createChainMock({
      data: {
        id: 'user-1',
        email: 'client@test.com',
        display_name: 'Client',
        avatar_url: null,
        role: 'client',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profilesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await requireApiStudioUser()

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(403)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Forbidden',
      })
    }
  })

  test('requireApiProfile returns auth and profile for authenticated users', async () => {
    const profilesChain = createChainMock({
      data: {
        id: 'user-1',
        email: 'studio@test.com',
        display_name: 'Studio User',
        avatar_url: null,
        role: 'studio',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profilesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await requireApiProfile()

    expect('response' in result).toBe(false)
    if (!('response' in result)) {
      expect(result.user.email).toBe('test@example.com')
      expect(result.profile?.role).toBe('studio')
    }
  })

  test('getAuthProfile reads the expected fields', async () => {
    const profilesChain = createChainMock({
      data: {
        id: 'user-1',
        email: 'studio@test.com',
        display_name: 'Studio User',
        avatar_url: null,
        role: 'studio',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profilesChain },
    })

    const profile = await getAuthProfile(supabase as never, 'user-1')

    expect(profile?.role).toBe('studio')
    expect(profilesChain.select).toHaveBeenCalledWith(
      'id, email, display_name, avatar_url, role',
    )
    expect(profilesChain.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  test('getProjectOrApiNotFound returns 404 response when project is missing', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    const result = await getProjectOrApiNotFound<{ id: string }>(
      supabase as never,
      'proj-404',
      'id',
    )

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(404)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Project not found',
      })
    }
  })

  test('requirePageUser redirects to login when auth is missing', async () => {
    mockCreateClient.mockResolvedValue(null)

    await expect(requirePageUser()).rejects.toThrow('REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  test('requirePageProfile returns auth context with profile data', async () => {
    const profilesChain = createChainMock({
      data: {
        id: 'user-1',
        email: 'studio@test.com',
        display_name: 'Studio User',
        avatar_url: null,
        role: 'studio',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profilesChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const result = await requirePageProfile()

    expect(result.user.id).toBe('user-1')
    expect(result.profile?.display_name).toBe('Studio User')
  })

  test('getProjectOrNotFound delegates missing projects to notFound', async () => {
    const projectsChain = createChainMock({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    await expect(
      getProjectOrNotFound<{ id: string }>(supabase as never, 'proj-404', 'id'),
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })
})
