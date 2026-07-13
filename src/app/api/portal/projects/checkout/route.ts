import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { CA_TAX_RATES, computeOrderPrice } from '@/lib/stripe/pricing'
import { reserveOrderDiscount } from '@/lib/portal/orderDiscount'
import { TERMS_VERSION } from '@/lib/legal/terms'
import type { BuyerCountry, BuyerLocation, CAProvince } from '@/types/portal'

const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_PENDING = 3

const FORMATS = ['atmos', 'binaural', 'both'] as const
const MAX_SONG_COUNT = 99
const MAX_STEM_COUNT = 999
const MAX_TEXT_LENGTH = 5000

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
        billingCountry?: unknown
        billingProvince?: unknown
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

  // Billing location for GST/HST (#31, D2): the tax rate keys off the
  // buyer's country + Canadian province (place of supply). A stray province
  // sent with a non-CA country is force-nulled, matching the DB pairing
  // constraint. Membership in CA_TAX_RATES keeps route and module on one
  // source for what counts as a province.
  const billingCountry =
    typeof body?.billingCountry === 'string' ? body.billingCountry : ''
  if (!['CA', 'US', 'OTHER'].includes(billingCountry)) {
    return NextResponse.json(
      { error: 'Select a billing country' },
      { status: 400 },
    )
  }
  let billingProvince: CAProvince | null = null
  if (billingCountry === 'CA') {
    const province =
      typeof body?.billingProvince === 'string' ? body.billingProvince : ''
    if (!(province in CA_TAX_RATES)) {
      return NextResponse.json(
        { error: 'Select a province or territory' },
        { status: 400 },
      )
    }
    billingProvince = province as CAProvince
  }
  const buyer: BuyerLocation = {
    country: billingCountry as BuyerCountry,
    province: billingProvince,
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
  // the user's one-shot discount with nothing left to restore it. The
  // dev-bypass service client is resolved here for the same reason — its
  // born-paid insert is a system write (the 20260708 insert fence 42501s
  // client sessions creating anything but unpaid pending_payment rows), so
  // it needs SUPABASE_SERVICE_ROLE_KEY. Dev-only path; prod never sets
  // PAYMENTS_DEV_BYPASS.
  const devBypass = process.env.PAYMENTS_DEV_BYPASS === 'true'
  let stripe: ReturnType<typeof getStripe> | null = null
  let serviceSupabase: SupabaseClient | null = null
  if (devBypass) {
    try {
      serviceSupabase = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Payments not configured' },
        { status: 500 },
      )
    }
  } else {
    try {
      stripe = getStripe()
    } catch {
      return NextResponse.json(
        { error: 'Payments not configured' },
        { status: 500 },
      )
    }
  }

  // Atomically reserve the order's discount (the #38 seam; today the one-shot
  // first-mix flag, catalog codes with #25). Every failure path past this
  // point must end in `reservation.release()`.
  const { reservation, error: reserveError } = await reserveOrderDiscount(
    supabase,
    user.id,
  )
  if (!reservation) {
    return NextResponse.json({ error: reserveError }, { status: 500 })
  }
  const discountApplied = reservation.applied

  const breakdown = computeOrderPrice({
    songCount,
    code: reservation.code,
    buyer,
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
    // 0 = computed, zero-rated (non-CA); null is reserved for rows that
    // predate tax computation (20260713 migration).
    tax_cents: breakdown.tax_cents,
    buyer_country: billingCountry,
    buyer_province: billingProvince,
  }

  if (devBypass) {
    if (!serviceSupabase) {
      return NextResponse.json(
        { error: 'Payments not configured' },
        { status: 500 },
      )
    }
    // Dev-only: the charge is skipped (amount 0), but the order fields keep
    // the real quote so the downstream UI can be exercised against it. The
    // insert runs on the service client — it creates a born-paid row, which
    // the insert fence reserves for the payment system.
    const { data: project, error: insertError } = await serviceSupabase
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
      await reservation.release()
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
        tax_cents: String(breakdown.tax_cents),
        tax_region: billingProvince ? `CA-${billingProvince}` : billingCountry,
      },
    })
  } catch (err) {
    await reservation.release()
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
    await reservation.release()
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
        tax_cents: String(breakdown.tax_cents),
        tax_region: billingProvince ? `CA-${billingProvince}` : billingCountry,
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
