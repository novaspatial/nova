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
  redirect: (path: string) => mockRedirect(path),
  notFound: () => mockNotFound(),
}))

import {
  getAuthProfile,
  getProjectOrApiNotFound,
  getProjectOrNotFound,
  requireApiProfile,
  requireApiStudioUser,
  requireApiUser,
  requirePageProfile,
  requirePageStudioUser,
  requirePageUser,
  requireProjectChild,
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

  test('getProjectOrApiNotFound hides projects removed by the client', async () => {
    const projectsChain = createChainMock({
      data: {
        id: 'proj-hidden',
        client_deleted_at: '2026-03-14T00:00:00.000Z',
        studio_deleted_at: null,
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    const result = await getProjectOrApiNotFound<{ id: string }>(
      supabase as never,
      'proj-hidden',
      'id',
      'client',
    )

    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(404)
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

  test('requirePageStudioUser redirects to login when auth is missing', async () => {
    mockCreateClient.mockResolvedValue(null)

    await expect(requirePageStudioUser()).rejects.toThrow('REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  test('requirePageStudioUser redirects non-studio users to the portal', async () => {
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

    await expect(requirePageStudioUser()).rejects.toThrow('REDIRECT:/portal')
    expect(mockRedirect).toHaveBeenCalledWith('/portal')
  })

  test('requirePageStudioUser returns auth context for studio users', async () => {
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

    const result = await requirePageStudioUser()

    expect(result.user.id).toBe('user-1')
    expect(result.profile?.role).toBe('studio')
    expect(mockRedirect).not.toHaveBeenCalled()
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

  test('getProjectOrNotFound hides projects removed by the studio', async () => {
    const projectsChain = createChainMock({
      data: {
        id: 'proj-hidden',
        client_deleted_at: null,
        studio_deleted_at: '2026-03-14T00:00:00.000Z',
      },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { projects: projectsChain },
    })

    await expect(
      getProjectOrNotFound<{ id: string }>(
        supabase as never,
        'proj-hidden',
        'id',
        'studio',
      ),
    ).rejects.toThrow('NOT_FOUND')
  })

  describe('requireProjectChild', () => {
    function makeAuth(
      supabase: ReturnType<typeof createSupabaseMock>,
      role: 'client' | 'studio' = 'client',
      userId = 'user-1',
    ) {
      return {
        supabase: supabase as never,
        user: { id: userId } as never,
        profile: {
          id: userId,
          email: null,
          display_name: null,
          avatar_url: null,
          role,
        } as never,
      }
    }

    test('404s when the project is not visible, before any child read', async () => {
      const commentsChain = createChainMock()
      const supabase = createSupabaseMock({
        fromMocks: {
          projects: createChainMock({ data: null, error: null }),
          project_comments: commentsChain,
        },
      })

      const result = await requireProjectChild(makeAuth(supabase), {
        projectId: 'proj-404',
        table: 'project_comments',
        rowId: 'c-1',
        select: 'id, author_id',
      })

      expect('response' in result).toBe(true)
      if ('response' in result) {
        expect(result.response.status).toBe(404)
        await expect(result.response.json()).resolves.toEqual({
          error: 'Project not found',
        })
      }
      expect(commentsChain.select).not.toHaveBeenCalled()
    })

    test('404s with the caller message when the child row is missing', async () => {
      const supabase = createSupabaseMock({
        fromMocks: {
          projects: createChainMock({
            data: { id: 'proj-1', owner_id: 'user-1' },
            error: null,
          }),
          project_files: createChainMock({ data: null, error: null }),
        },
      })

      const result = await requireProjectChild(makeAuth(supabase), {
        projectId: 'proj-1',
        table: 'project_files',
        rowId: 'f-404',
        select: 'storage_path',
        notFoundMessage: 'File not found',
      })

      expect('response' in result).toBe(true)
      if ('response' in result) {
        expect(result.response.status).toBe(404)
        await expect(result.response.json()).resolves.toEqual({
          error: 'File not found',
        })
      }
    })

    test('scopes the child load to the project and derives the flags', async () => {
      const filesChain = createChainMock({
        data: { storage_path: 'o/p/kick.wav', uploaded_by: 'user-1' },
        error: null,
      })
      const supabase = createSupabaseMock({
        fromMocks: {
          projects: createChainMock({
            data: { id: 'proj-1', owner_id: 'owner-2' },
            error: null,
          }),
          project_files: filesChain,
        },
      })

      const result = await requireProjectChild<{
        storage_path: string
        uploaded_by: string
      }>(makeAuth(supabase), {
        projectId: 'proj-1',
        table: 'project_files',
        rowId: 'f-1',
        select: 'storage_path, uploaded_by',
        authorField: 'uploaded_by',
      })

      expect('response' in result).toBe(false)
      if (!('response' in result)) {
        expect(result.row.storage_path).toBe('o/p/kick.wav')
        expect(result.isStudio).toBe(false)
        expect(result.isOwner).toBe(false) // project owned by owner-2
        expect(result.isAuthor).toBe(true) // row uploaded by user-1
      }
      expect(filesChain.eq).toHaveBeenCalledWith('id', 'f-1')
      expect(filesChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    })

    test('studio callers get isStudio and isAuthor stays false without authorField', async () => {
      const supabase = createSupabaseMock({
        fromMocks: {
          projects: createChainMock({
            data: { id: 'proj-1', owner_id: 'user-1' },
            error: null,
          }),
          project_comment_attachments: createChainMock({
            data: { storage_path: 'o/p/comments/u/note.pdf' },
            error: null,
          }),
        },
      })

      const result = await requireProjectChild(
        makeAuth(supabase, 'studio', 'user-1'),
        {
          projectId: 'proj-1',
          table: 'project_comment_attachments',
          rowId: 'a-1',
          select: 'storage_path',
        },
      )

      expect('response' in result).toBe(false)
      if (!('response' in result)) {
        expect(result.isStudio).toBe(true)
        expect(result.isOwner).toBe(true)
        expect(result.isAuthor).toBe(false)
      }
    })
  })

})
