import { createClient } from '@/lib/supabase/supabaseServer'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/auth/nextPath'
import { resolveRedirectOrigin } from '@/lib/auth/redirectOrigin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
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

  return NextResponse.redirect(`${redirectOrigin}/login?error=auth-code-error`)
}
