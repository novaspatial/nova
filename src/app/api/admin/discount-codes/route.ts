import { NextResponse, type NextRequest } from 'next/server'
import { requireApiStudioUser } from '@/lib/auth/server'
// CODE NAME rules: uppercase alphanumeric with _ or -, 3–40 chars. The DB
// CHECK mirrors this; the route normalizes (trim + uppercase) before it.
import { CODE_PATTERN, WELCOME_COUPON_CODE } from '@/lib/portal/orderDiscount'

const KINDS = ['percent', 'fixed'] as const

export async function GET() {
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const { data: codes, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(codes)
}

export async function POST(request: NextRequest) {
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const body = await request.json().catch(() => null) as
    | {
        code?: unknown
        kind?: unknown
        value?: unknown
        expiresAt?: unknown
        isPublic?: unknown
        singleUse?: unknown
        usageLimit?: unknown
        newClientsOnly?: unknown
        returningClientsOnly?: unknown
        referralAttribution?: unknown
      }
    | null

  const code =
    typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      {
        error:
          'Code must be 3–40 characters: letters, numbers, underscores, or dashes',
      },
      { status: 400 },
    )
  }
  // The welcome offer resolves in code (D11) and would shadow a catalog row
  // of the same name — refuse to create one that could never apply.
  if (code === WELCOME_COUPON_CODE) {
    return NextResponse.json(
      { error: `"${WELCOME_COUPON_CODE}" is reserved for the welcome offer` },
      { status: 400 },
    )
  }

  const kind = body?.kind
  if (typeof kind !== 'string' || !KINDS.includes(kind as (typeof KINDS)[number])) {
    return NextResponse.json(
      { error: 'Type must be percent or fixed' },
      { status: 400 },
    )
  }

  const value = body?.value
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return NextResponse.json(
      { error: 'Value must be a positive whole number' },
      { status: 400 },
    )
  }
  if (kind === 'percent' && value > 100) {
    return NextResponse.json(
      { error: 'Percent codes cannot exceed 100' },
      { status: 400 },
    )
  }

  let expiresAt: string | null = null
  if (body?.expiresAt !== undefined && body.expiresAt !== null) {
    const parsed =
      typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : NaN
    if (Number.isNaN(parsed)) {
      return NextResponse.json(
        { error: 'Expiry must be a valid date' },
        { status: 400 },
      )
    }
    expiresAt = new Date(parsed).toISOString()
  }

  const usageLimit = body?.usageLimit ?? null
  if (
    usageLimit !== null &&
    (typeof usageLimit !== 'number' ||
      !Number.isInteger(usageLimit) ||
      usageLimit < 1)
  ) {
    return NextResponse.json(
      { error: 'Usage limit must be a whole number of at least 1' },
      { status: 400 },
    )
  }

  const newClientsOnly = body?.newClientsOnly === true
  const returningClientsOnly = body?.returningClientsOnly === true
  if (newClientsOnly && returningClientsOnly) {
    return NextResponse.json(
      { error: 'A code cannot be both new-clients-only and returning-only' },
      { status: 400 },
    )
  }

  const referralAttribution =
    typeof body?.referralAttribution === 'string' &&
    body.referralAttribution.trim()
      ? body.referralAttribution.trim()
      : null

  const { data: created, error } = await supabase
    .from('discount_codes')
    .insert({
      code,
      kind,
      value,
      is_public: body?.isPublic === true,
      single_use: body?.singleUse === true,
      usage_limit: usageLimit,
      new_clients_only: newClientsOnly,
      returning_clients_only: returningClientsOnly,
      referral_attribution: referralAttribution,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error || !created) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: `Code "${code}" already exists` },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to create code' },
      { status: 500 },
    )
  }

  return NextResponse.json(created, { status: 201 })
}
