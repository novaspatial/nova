import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockUseAuthUser = vi.fn()

vi.mock('./useAuthUser', () => ({
  useAuthUser: (...args: unknown[]) => mockUseAuthUser(...args),
}))

import { useProfile } from './useProfile'

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('stays disabled when auth awareness is turned off', () => {
    mockUseAuthUser.mockReturnValue({
      user: null,
      loading: false,
      supabase: null,
    })

    const { result } = renderHook(() => useProfile(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.profile).toBeNull()
    expect(result.current.isStudio).toBe(false)
  })

  test('waits for auth resolution before querying the profile table', () => {
    const from = vi.fn()
    mockUseAuthUser.mockReturnValue({
      user: null,
      loading: true,
      supabase: { from },
    })

    const { result } = renderHook(() => useProfile())

    expect(result.current.loading).toBe(true)
    expect(from).not.toHaveBeenCalled()
  })

  test('returns no profile when there is no authenticated user', async () => {
    mockUseAuthUser.mockReturnValue({
      user: null,
      loading: false,
      supabase: null,
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.profile).toBeNull()
    expect(result.current.user).toBeNull()
  })

  test('loads the profile and derives the studio flag', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'studio@test.com',
        display_name: 'Studio User',
        avatar_url: null,
        role: 'studio',
      },
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    mockUseAuthUser.mockReturnValue({
      user: { id: 'user-1', email: 'studio@test.com' },
      loading: false,
      supabase: { from },
    })

    const { result } = renderHook(() => useProfile())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith(
      'id, email, display_name, avatar_url, role',
    )
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(result.current.profile?.display_name).toBe('Studio User')
    expect(result.current.isStudio).toBe(true)
  })
})
