'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? '',
  )
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile?.id)

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    }

    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-zinc-300"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="avatarUrl"
            className="block text-sm font-medium text-zinc-300"
          >
            Avatar URL
          </label>
          <input
            id="avatarUrl"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {saved && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Profile updated successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-8 border-t border-white/10 pt-8">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
