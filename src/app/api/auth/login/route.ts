import { lookup } from 'node:dns/promises'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/supabaseServer'

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
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const message = error.message || 'Authentication failed.'
      const isNetworkError =
        message.includes('fetch failed') ||
        message.includes('NetworkError') ||
        'status' in error && error.status === 0

      return NextResponse.json(
        {
          error: isNetworkError
            ? 'Unable to reach the authentication service. Please try again in a moment.'
            : message,
        },
        { status: isNetworkError ? 503 : 400 },
      )
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
