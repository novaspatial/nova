import type { User } from '@supabase/supabase-js'
import { useEffect, useState, useMemo } from 'react'

import { createClient } from '@/lib/supabase/supabaseClient'

export function useAuthUser(enabled = true) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(enabled)
  const supabase = useMemo(
    () => (enabled ? createClient() : null),
    [enabled],
  )

  useEffect(() => {
    if (!enabled || !supabase) {
      setUser(null)
      setLoading(false)
      return
    }

    // onAuthStateChange fires INITIAL_SESSION immediately from the local cookie,
    // so no separate getUser() network call is needed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [enabled, supabase])

  return { user, loading, supabase }
}
