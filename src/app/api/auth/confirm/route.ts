import { NextResponse } from 'next/server'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/supabaseServer'
import { CONFIRM_TYPES, isConfirmType } from '@/lib/auth/confirmTypes'
import { safeNextPath } from '@/lib/auth/nextPath'
import { resolveRedirectOrigin } from '@/lib/auth/redirectOrigin'

// Target of the native <form> on /auth/confirm. Every response is a 303
// redirect: the browser is mid-navigation, so JSON bodies (including the
// DNS-preflight 503 the other auth routes return) would render as raw text.
// An unreachable Supabase host falls into the network branch below, which
// sends the still-unspent token back to the confirm page for a retry.

// This route trades the code-exchange flow's implicit CSRF protection (a
// PKCE verifier cookie set at signup, in the same browser) for cross-device
// confirmation, so it needs an explicit same-origin check instead: without
// one, a cross-site auto-submitting form could drive a victim's browser to
// spend an attacker-supplied token_hash, writing the attacker's session
// cookies into the victim's browser. POST requests always carry Origin per
// the fetch spec, and modern browsers send Sec-Fetch-Site; both are checked,
// but only enforced when present, since some legacy browsers send neither.
function isSameOriginPost(request: Request, origin: string): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') {
    return false
  }
  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && requestOrigin !== origin) {
    return false
  }
  return true
}

export async function POST(request: Request) {
  const origin = resolveRedirectOrigin(request)
  const fail = (
    code: 'auth-code-error' | 'confirm-link-used' | 'recovery-link-used',
  ) => NextResponse.redirect(`${origin}/login?error=${code}`, 303)

  if (!isSameOriginPost(request, origin)) {
    return fail('auth-code-error')
  }

  try {
    const form = await request.formData()
    const tokenHash = form.get('token_hash')
    const type = form.get('type')

    if (typeof tokenHash !== 'string' || !tokenHash || !isConfirmType(type)) {
      return fail('auth-code-error')
    }

    // Hidden form fields are attacker-editable, so next is re-sanitized here
    // even though the page already sanitized it (#56).
    const next = safeNextPath(form.get('next'), CONFIRM_TYPES[type])

    const supabase = await createClient()
    if (!supabase) {
      return fail('auth-code-error')
    }

    // Session cookies flush as a side effect of the shared cookie store,
    // exactly like signInWithPassword in the login route.
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`, 303)
    }

    const message = error.message || ''
    // isAuthRetryableFetchError also catches GoTrue/gateway 5xx responses
    // (auth-js wraps those as AuthRetryableFetchError with the real status,
    // not just transport failures at status 0) — the string/status-0 checks
    // stay as a fallback for anything that classifier doesn't recognize.
    const isNetworkError =
      isAuthRetryableFetchError(error) ||
      message.includes('fetch failed') ||
      message.includes('NetworkError') ||
      ('status' in error && error.status === 0)

    if (isNetworkError) {
      const retry = new URL(`${origin}/auth/confirm`)
      retry.searchParams.set('token_hash', tokenHash)
      retry.searchParams.set('type', type)
      retry.searchParams.set('next', next)
      retry.searchParams.set('error', 'retry')
      return NextResponse.redirect(retry, 303)
    }

    // GoTrue reports a consumed or expired one-shot token as otp_expired
    // ("One-time token not found" / "Email link is invalid or has expired").
    // Scope the message fallback to GoTrue's verify-failure status (403) so
    // an unrelated error sharing one of these words (e.g. a misconfigured
    // API key) isn't mislabeled as a used link.
    const isUsedOrExpired =
      ('code' in error && error.code === 'otp_expired') ||
      (('status' in error ? error.status : undefined) === 403 &&
        /expired|invalid|not found/i.test(message))

    if (!isUsedOrExpired) {
      return fail('auth-code-error')
    }

    // A recovery link is consumed differently from a signup link: the
    // account usually IS confirmed for signup (a link scanner spent the
    // token), but a used/expired recovery link means the user still can't
    // sign in without a password. Send them straight back to reset mode
    // instead of the signup-flavored "just sign in" guidance.
    return fail(type === 'recovery' ? 'recovery-link-used' : 'confirm-link-used')
  } catch {
    return fail('auth-code-error')
  }
}
