import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'
import { resolveSubmittedCode } from '@/lib/portal/orderDiscount'
import { createServiceClient } from '@/lib/supabase/supabaseService'

/**
 * Preview validation for the order form's discount-code field (#25): resolves
 * a submitted code into the OrderCode the client feeds its own
 * `computeOrderPrice` quote — the same resolver the checkout charge uses, so
 * quote and charge cannot disagree. No side effects: nothing is reserved or
 * consumed here, and checkout re-validates from scratch on submit.
 *
 * Enumeration posture: authenticated-only, exact-match lookups, and
 * deactivated codes answer exactly like unknown ones.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const body = (await request.json().catch(() => null)) as
    | { code?: unknown }
    | null
  const code =
    typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ error: 'Enter a discount code' }, { status: 400 })
  }

  // The catalog lookup runs on the service client (20260731 grants); a
  // missing key is the same infrastructure answer as a failed lookup.
  let serviceSupabase
  try {
    serviceSupabase = createServiceClient()
  } catch {
    return NextResponse.json(
      { error: 'Unable to validate the code right now. Please try again.' },
      { status: 503 },
    )
  }

  const resolution = await resolveSubmittedCode(
    supabase,
    serviceSupabase,
    user.id,
    code,
  )
  if (!resolution.ok) {
    if (resolution.rejection) {
      return NextResponse.json(
        { error: resolution.rejection.message },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: 'Unable to validate the code right now. Please try again.' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    couponCode: resolution.couponCode,
    code: resolution.code,
  })
}
