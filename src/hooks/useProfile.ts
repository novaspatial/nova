import { useEffect, useState } from 'react'
import { useAuthUser } from './useAuthUser'
import type { UserRole } from '@/types/portal'

interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: UserRole
}

export function useProfile(enabled = true) {
  const { user, loading: authLoading, supabase } = useAuthUser(enabled)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setProfile(null)
      setLoading(false)
      return
    }

    if (authLoading) return

    if (!user || !supabase) {
      setProfile(null)
      setLoading(false)
      return
    }

    supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null)
        setLoading(false)
      })
  }, [enabled, user, authLoading, supabase])

  return {
    user,
    profile,
    isStudio: profile?.role === 'studio',
    loading,
    supabase,
  }
}
