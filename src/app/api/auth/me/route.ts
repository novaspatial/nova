import { lookup } from 'node:dns/promises'

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/supabaseServer'

const supabaseAuthCookiePattern = /^sb-.*-auth-token(?:\.\d+)?$/

function hasSupabaseAuthCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie')

  if (!cookieHeader) {
    return false
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .some((name) => supabaseAuthCookiePattern.test(name))
}

async function isSupabaseHostReachable() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!supabaseUrl) {
      return false
    }

    const { hostname } = new URL(supabaseUrl)
    await lookup(hostname)
    return true
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!hasSupabaseAuthCookie(request)) {
    return new NextResponse(null, { status: 204 })
  }

  const reachable = await isSupabaseHostReachable()
  if (!reachable) {
    return new NextResponse(null, { status: 204 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse(null, { status: 204 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
