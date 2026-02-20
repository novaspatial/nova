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

type FeedbackState = {
  type: 'success' | 'error'
  message: string
} | null

const inputClassName =
  'mt-1.5 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500'

function Feedback({ state }: { state: FeedbackState }) {
  if (!state) return null
  const isError = state.type === 'error'
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        isError
          ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {state.message}
    </div>
  )
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? '',
  )
  const [newEmail, setNewEmail] = useState(profile?.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setLoading(true)
    setFeedback(null)

    const messages: string[] = []

    const nameChanged = displayName !== (profile?.display_name ?? '')
    const emailChanged = newEmail !== profile?.email
    const wantsPasswordChange = newPassword.length > 0 || confirmPassword.length > 0

    if (!nameChanged && !emailChanged && !wantsPasswordChange) {
      setFeedback({ type: 'error', message: 'No changes to save.' })
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
      return
    }

    // Password validation
    if (wantsPasswordChange) {
      if (newPassword.length < 6) {
        setFeedback({
          type: 'error',
          message: 'Password must be at least 6 characters.',
        })
        setLoading(false)
        return
      }
      if (newPassword !== confirmPassword) {
        setFeedback({
          type: 'error',
          message: 'Passwords do not match.',
        })
        setLoading(false)
        return
      }
    }

    if (nameChanged) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile?.id)

      if (profileError) {
        setFeedback({ type: 'error', message: profileError.message })
        setLoading(false)
        return
      }

      // Sync display name to auth user metadata so the navbar updates
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      })

      if (metaError) {
        setFeedback({ type: 'error', message: metaError.message })
        setLoading(false)
        return
      }
      messages.push('Profile updated')
    }

    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: newEmail,
      })
      if (emailError) {
        setFeedback({ type: 'error', message: emailError.message })
        setLoading(false)
        return
      }
      messages.push('confirmation email sent to verify new address')
    }

    if (wantsPasswordChange) {
      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (pwError) {
        setFeedback({ type: 'error', message: pwError.message })
        setLoading(false)
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      messages.push('password changed')
    }

    setFeedback({
      type: 'success',
      message: messages.join(', ') + '.',
    })
    router.refresh()
    setTimeout(() => setFeedback(null), 5000)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase?.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div>
      <form onSubmit={handleSave} className="space-y-8">
        {/* Display Name */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Display Name</h3>
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-zinc-300"
            >
              Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClassName}
              placeholder="Your name"
            />
          </div>
        </div>

        <div className="border-t border-white/10" />

        {/* Email */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Email Address</h3>
          <div>
            <label
              htmlFor="newEmail"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClassName}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="border-t border-white/10" />

        {/* Password */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Change Password</h3>
          <p className="text-sm text-zinc-500">
            Leave blank to keep your current password.
          </p>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-zinc-300"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClassName}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-300"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClassName}
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <Feedback state={feedback} />

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
