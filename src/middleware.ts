import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseAuthCookiePattern = /^sb-.*-auth-token(?:\.\d+)?$/

// Everything this middleware matches (/portal, /profile, /blog/admin) is the private,
// auth-gated surface and must never appear in search results. A robots.txt
// Disallow only blocks crawling — it does NOT remove an already-indexed URL,
// which leaves Google showing the bare URL with a generic snippet. A noindex
// directive the crawler can actually see is what de-indexes it, so we attach
// it as a header on every response (including the login redirect Googlebot
// hits when it crawls /portal).
function withNoindex<T extends Response>(response: T): T {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

// Where to send a signed-out visitor who hits a protected route.
//
// Bare entry points (/portal, /profile) — what someone types, bookmarks, or
// finds in search — go to the public home page, so clients meet the main
// marketing site and log in from the navbar when ready, instead of being
// dropped straight onto a bare login form.
//
// Deeper links (e.g. the /portal/<projectId> review link emailed to a client)
// keep the login?next flow, so after signing in the client lands on the exact
// page they were trying to reach rather than the generic home page.
function redirectUnauthenticated(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const url = request.nextUrl.clone()
  url.search = ''

  if (pathname === '/portal' || pathname === '/profile') {
    url.pathname = '/'
  } else {
    url.pathname = '/login'
    url.searchParams.set('next', `${pathname}${search}`)
  }

  return withNoindex(NextResponse.redirect(url))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const authCookieNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => supabaseAuthCookiePattern.test(name))

  if (!supabaseUrl || !supabaseKey) {
    return withNoindex(supabaseResponse)
  }

  // If there is no Supabase auth cookie at all, avoid creating the auth client.
  // This keeps protected-route requests quiet for clearly unauthenticated visitors.
  if (authCookieNames.length === 0) {
    return redirectUnauthenticated(request)
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
    const response = redirectUnauthenticated(request)

    // Clear stale auth cookies so failed refresh attempts do not keep repeating.
    if (authCheckFailed) {
      authCookieNames.forEach((name) => response.cookies.delete(name))
    }

    return response
  }

  return withNoindex(supabaseResponse)
}

export const config = {
  matcher: ['/portal/:path*', '/profile/:path*', '/blog/admin/:path*'],
}
