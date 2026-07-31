import { createClient } from '@/lib/supabase/supabaseServer'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/nextPath'
import { resolveRedirectOrigin } from '@/lib/auth/redirectOrigin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // GoTrue reports a consumed/expired one-shot link as
  // ?error=access_denied&error_code=otp_expired — a distinct, actionable
  // case: the user is usually already confirmed and just needs to sign in.
  const errorCode = searchParams.get('error_code')
  // Both halves of the redirect target are attacker-controllable (#56):
  // the path comes from the link, the host from a forwardable header.
  const next = safeNextPath(searchParams.get('next'))
  const redirectOrigin = resolveRedirectOrigin(request)

  if (code) {
    const supabase = await createClient()
    const result = await supabase?.auth.exchangeCodeForSession(code)
    if (!result?.error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`)
    }
  }

  if (errorCode !== 'otp_expired') {
    return NextResponse.redirect(`${redirectOrigin}/login?error=auth-code-error`)
  }

  // This route carries no explicit type — infer recovery from the target the
  // reset-password route always requests, so an expired reset link doesn't
  // get the signup-flavored "just sign in" guidance (see /api/auth/confirm
  // for the type-aware version of this same distinction).
  const failure = next === '/auth/update-password' ? 'recovery-link-used' : 'confirm-link-used'
  return NextResponse.redirect(`${redirectOrigin}/login?error=${failure}`)
}
