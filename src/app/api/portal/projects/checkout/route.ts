import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { computeOrderPrice, type OrderCode } from '@/lib/stripe/pricing'
import { TERMS_VERSION } from '@/lib/legal/terms'

const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_PENDING = 3

const FORMATS = ['atmos', 'binaural', 'both'] as const
const MAX_SONG_COUNT = 99
const MAX_STEM_COUNT = 999
const MAX_TEXT_LENGTH = 5000

// The one-shot first-mix discount rides the per-song pricing module as a
// private percent code: private codes do not stack with the bulk tier, and
// the $225/song floor bounds what "50% off" can actually realize (D4 guard
// rails, approved 2026-07-02). The percentage moves to the welcome code
// system in S4b (#25) / D11.
const FIRST_MIX_CODE: OrderCode = { kind: 'percent', value: 50, scope: 'private' }

function parseCount(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < min || value > max) return null
  return value
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const body = await request.json().catch(() => null) as
    | {
        title?: unknown
        format?: unknown
        notes?: unknown
        referenceTracks?: unknown
        songCount?: unknown
        stemCount?: unknown
        termsAcceptedVersion?: unknown
      }
    | null

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const format = body?.format === undefined ? 'atmos' : body.format
  if (typeof format !== 'string' || !FORMATS.includes(format as (typeof FORMATS)[number])) {
    return NextResponse.json({ error: 'Invalid service format' }, { status: 400 })
  }

  const songCount = parseCount(body?.songCount, 1, MAX_SONG_COUNT)
  if (songCount === null) {
    return NextResponse.json(
      { error: `Song count must be a whole number between 1 and ${MAX_SONG_COUNT}` },
      { status: 400 },
    )
  }

  const stemCount = parseCount(body?.stemCount, 1, MAX_STEM_COUNT)
  if (stemCount === null) {
    return NextResponse.json(
      { error: `Stem count must be a whole number between 1 and ${MAX_STEM_COUNT}` },
      { status: 400 },
    )
  }

  const notes = typeof body?.notes === 'string' ? body.notes : null
  const referenceTracks =
    typeof body?.referenceTracks === 'string' && body.referenceTracks.trim()
      ? body.referenceTracks.trim()
      : null
  if (
    (notes && notes.length > MAX_TEXT_LENGTH) ||
    (referenceTracks && referenceTracks.length > MAX_TEXT_LENGTH)
  ) {
    return NextResponse.json(
      { error: `Notes and reference tracks must be under ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    )
  }

  // T&C consent (#23): the client echoes the version it displayed; reject unless
  // it matches the current terms, which forces re-consent on a stale tab across a
  // deploy. We record the server-side TERMS_VERSION below, never the client value.
  // Gate here, before any Stripe/reservation side effect, so a rejection never
  // creates a PaymentIntent or burns the first-mix discount.
  const termsAcceptedVersion =
    typeof body?.termsAcceptedVersion === 'string' ? body.termsAcceptedVersion : ''
  if (!termsAcceptedVersion || termsAcceptedVersion !== TERMS_VERSION) {
    return NextResponse.json(
      { error: 'You must accept the current Terms & Conditions to continue.' },
      { status: 400 },
    )
  }

  // Rate limit: count recent pending_payment projects for this user.
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
  ).toISOString()
  const { count: pendingCount, error: countError } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('status', 'pending_payment')
    .gte('created_at', windowStart)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }
  if ((pendingCount ?? 0) >= RATE_LIMIT_MAX_PENDING) {
    return NextResponse.json(
      { error: 'Too many pending checkouts. Please wait a minute and retry.' },
      { status: 429 },
    )
  }

  // Resolve the Stripe client BEFORE reserving the discount: getStripe()
  // throws on missing config, and a throw after the reservation would burn
  // the user's one-shot discount with nothing left to restore it.
  const devBypass = process.env.PAYMENTS_DEV_BYPASS === 'true'
  let stripe: ReturnType<typeof getStripe> | null = null
  if (!devBypass) {
    try {
      stripe = getStripe()
    } catch {
      return NextResponse.json(
        { error: 'Payments not configured' },
        { status: 500 },
      )
    }
  }

  // Atomically reserve the first-mix discount (flip true -> false).
  const { data: reservedData, error: reserveError } = await supabase.rpc(
    'reserve_first_mix_discount',
    { p_user_id: user.id },
  )
  if (reserveError) {
    return NextResponse.json({ error: reserveError.message }, { status: 500 })
  }
  const discountApplied = reservedData === true

  const breakdown = computeOrderPrice({
    songCount,
    code: discountApplied ? FIRST_MIX_CODE : null,
  })
  const amountCents = breakdown.total_cents
  const currency = breakdown.currency

  const nowIso = new Date().toISOString()
  const orderFields = {
    song_count: songCount,
    stem_count: stemCount,
    subtotal_cents: breakdown.subtotal_cents,
    reference_tracks: referenceTracks,
    terms_accepted_at: nowIso,
    terms_version: TERMS_VERSION,
  }

  if (devBypass) {
    // Dev-only: the charge is skipped (amount 0), but the order fields keep
    // the real quote so the downstream UI can be exercised against it.
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        title,
        format,
        notes,
        status: 'uploading',
        amount_cents: 0,
        currency,
        discount_applied: discountApplied,
        paid_at: nowIso,
        ...orderFields,
      })
      .select('id')
      .single()

    if (insertError || !project) {
      if (discountApplied) {
        const { error: restoreError } = await supabase.rpc(
          'restore_first_mix_discount',
          { p_user_id: user.id },
        )
        if (restoreError) {
          console.error('[checkout] discount restore failed', restoreError)
        }
      }
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create project' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      projectId: project.id,
      devBypass: true,
      clientSecret: null,
      amountCents: 0,
      currency,
      discountApplied,
      breakdown,
    })
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 500 })
  }

  let intent
  try {
    intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      // Redirect-based methods (Klarna, Cash App Pay, ...) would navigate
      // away and lose the in-memory stem file list before the post-payment
      // upload runs; cards and Apple/Google Pay confirm in place. Wallet
      // enablement beyond this is a D3 sub-decision.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        user_id: user.id,
        discount_applied: String(discountApplied),
        song_count: String(songCount),
      },
    })
  } catch (err) {
    if (discountApplied) {
      const { error: restoreError } = await supabase.rpc(
        'restore_first_mix_discount',
        { p_user_id: user.id },
      )
      if (restoreError) {
        console.error('[checkout] discount restore failed', restoreError)
      }
    }
    const message =
      err instanceof Error ? err.message : 'Failed to create payment intent'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      title,
      format,
      notes,
      status: 'pending_payment',
      stripe_payment_intent_id: intent.id,
      amount_cents: amountCents,
      currency,
      discount_applied: discountApplied,
      ...orderFields,
    })
    .select('id')
    .single()

  if (insertError || !project) {
    // Roll back: cancel the intent and restore the reservation.
    try {
      await stripe.paymentIntents.cancel(intent.id)
    } catch (cancelErr) {
      console.error('[checkout] intent cancel failed', cancelErr)
    }
    if (discountApplied) {
      const { error: restoreError } = await supabase.rpc(
        'restore_first_mix_discount',
        { p_user_id: user.id },
      )
      if (restoreError) {
        console.error('[checkout] discount restore failed', restoreError)
      }
    }
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create project' },
      { status: 500 },
    )
  }

  // Best-effort: attach project id to Stripe intent metadata for
  // cross-checking in the webhook. If this fails, the webhook still
  // verifies via stripe_payment_intent_id + owner_id.
  try {
    await stripe.paymentIntents.update(intent.id, {
      metadata: {
        user_id: user.id,
        project_id: project.id,
        discount_applied: String(discountApplied),
        song_count: String(songCount),
      },
    })
  } catch (err) {
    console.error('[checkout] intent metadata patch failed', err)
  }

  return NextResponse.json({
    projectId: project.id,
    clientSecret: intent.client_secret,
    amountCents,
    currency,
    discountApplied,
    breakdown,
  })
}
