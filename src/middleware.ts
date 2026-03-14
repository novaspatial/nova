import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseAuthCookiePattern = /^sb-.*-auth-token(?:\.\d+)?$/

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const authCookieNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => supabaseAuthCookiePattern.test(name))

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  // If there is no Supabase auth cookie at all, avoid creating the auth client.
  // This keeps protected-route requests quiet for clearly unauthenticated visitors.
  if (authCookieNames.length === 0) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // getClaims() validates the JWT signature against the project's public keys,
  // making it safe to trust in server-side code (unlike getSession()).
  // Wrapped in try/catch because it may attempt a token refresh network call
  // that can fail when Supabase is unreachable (e.g. paused project, offline).
  let user: object | null = null
  let authCheckFailed = false
  try {
    const { data } = await supabase.auth.getClaims()
    user = data?.claims ?? null
  } catch {
    authCheckFailed = true
    // Treat failed auth check as unauthenticated — protected routes will redirect to login
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    const response = NextResponse.redirect(url)

    // Clear stale auth cookies so failed refresh attempts do not keep repeating.
    if (authCheckFailed) {
      authCookieNames.forEach((name) => response.cookies.delete(name))
    }

    return response
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/portal/:path*', '/profile/:path*'],
}
