import { lookup } from 'node:dns/promises'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/supabaseServer'
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
    const { email } = await request.json()

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

    // Same origin validation as the signup email link (#56): the reset
    // link must target a host on Supabase's redirect allowlist.
    const origin = resolveRedirectOrigin(request)
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/auth/update-password')}`

    // Intentionally ignore the error result to avoid leaking whether an
    // account exists for the given email. Genuine transport failures are
    // caught by the outer try/catch or the DNS check above.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo })

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
