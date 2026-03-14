import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createClient } from '@/lib/supabase/supabaseClient'

import { useAuthUser } from './useAuthUser'

describe('useAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('stays disabled when the hook is turned off', () => {
    const { result } = renderHook(() => useAuthUser(false))

    expect(result.current).toEqual({
      user: null,
      loading: false,
      supabase: null,
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  test('subscribes to auth state and hydrates from the initial session', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          callback('INITIAL_SESSION', {
            user: { id: 'user-1', email: 'user@test.com' },
          })
          return { data: { subscription: { unsubscribe } } }
        }),
      },
    } as never)

    const { result } = renderHook(() => useAuthUser())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'user@test.com',
    })
    expect(result.current.supabase).not.toBeNull()
  })

  test('unsubscribes on cleanup', () => {
    const unsubscribe = vi.fn()
    vi.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe } },
        })),
      },
    } as never)

    const { unmount } = renderHook(() => useAuthUser())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  test('clears the user when auth events contain no session', async () => {
    let emit:
      | ((event: string, session: { user?: { id: string } } | null) => void)
      | undefined
    vi.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          emit = callback
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          }
        }),
      },
    } as never)

    const { result } = renderHook(() => useAuthUser())

    act(() => {
      emit?.('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.user).toBeNull()
  })
})
