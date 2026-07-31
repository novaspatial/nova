import { lookup } from 'node:dns/promises'
import { NextResponse } from 'next/server'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/supabaseServer'
import { safeNextPath } from '@/lib/auth/nextPath'
import { resolveRedirectOrigin } from '@/lib/auth/redirectOrigin'

async function ensureSupabaseHostReachable() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!supabaseUrl) {
      throw new Error('Missing Supabase URL')
    }

    const { hostname } = new URL(supabaseUrl)
    await lookup(hostname)
    return null
  } catch {
    return NextResponse.json(
      {
        error:
          'Unable to reach the authentication service. Please try again in a moment.',
      },
      { status: 503 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { email, next } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 },
      )
    }

    const availabilityResponse = await ensureSupabaseHostReachable()
    if (availabilityResponse) {
      return availabilityResponse
    }

    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentication is not configured.' },
        { status: 500 },
      )
    }

    // Same origin validation as the signup route (#56). While the dashboard
    // email template still renders {{ .ConfirmationURL }}, redirect_to must
    // stay allowlist-valid; once the token_hash template ships, this option
    // is ignored harmlessly.
    const origin = resolveRedirectOrigin(request)
    const redirectTarget = safeNextPath(next, '/portal')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`,
      },
    })

    if (error) {
      const message = error.message || ''
      // isAuthRetryableFetchError also catches GoTrue/gateway 5xx responses,
      // not just transport failures at status 0 — the string/status-0
      // checks stay as a fallback for anything that classifier misses.
      const isNetworkError =
        isAuthRetryableFetchError(error) ||
        message.includes('fetch failed') ||
        message.includes('NetworkError') ||
        ('status' in error && error.status === 0)

      if (isNetworkError) {
        return NextResponse.json(
          {
            error:
              'Unable to reach the authentication service. Please try again in a moment.',
          },
          { status: 503 },
        )
      }

      // Everything else — including GoTrue's 429 cooldown — is intentionally
      // swallowed. The cooldown is keyed to whether a matching unconfirmed
      // account exists (GoTrue only throttles a real confirmation_sent_at
      // column), so surfacing it verbatim would turn this endpoint into an
      // account-existence oracle (#52) — same stance as the reset-password
      // route. The client's own 60s cooldown after a successful call is the
      // only rate-limit signal users see.
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      {
        error:
          'Unable to reach the authentication service. Please try again in a moment.',
      },
      { status: 503 },
    )
  }
}
