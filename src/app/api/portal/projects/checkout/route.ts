import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import {
  ADD_ON_VALUES,
  CA_TAX_RATES,
  computeOrderPrice,
  MAX_SONG_COUNT,
} from '@/lib/stripe/pricing'
import {
  CODE_REJECTION_MESSAGES,
  finalizeDiscountConsumption,
  reserveOrderDiscount,
  WELCOME_COUPON_CODE,
} from '@/lib/portal/orderDiscount'
import { TERMS_VERSION } from '@/lib/legal/terms'
import { sendOrderConfirmationEmail } from '@/lib/email/orderConfirmation'
import type {
  AddOn,
  BuyerCountry,
  BuyerLocation,
  CAProvince,
} from '@/types/portal'

const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_PENDING = 3

const FORMATS = ['atmos', 'binaural', 'both'] as const
const MAX_STEM_COUNT = 999
const MAX_TEXT_LENGTH = 5000

// Stripe refuses charges under ~$0.50 USD — a Stripe property, not pricing
// policy, so it lives here and not in the pure module. Reachable only via a
// deep below-floor code (D-floor-private).
const STRIPE_MIN_CHARGE_CENTS = 50

function parseCount(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < min || value > max) return null
  return value
}

/**
 * The one-WELCOME-per-owner partial unique index (20260715) refused the
 * insert: a second live WELCOME order for this user — either the losing
 * side of the concurrent-D5 race the index exists to close, or an
 * abandoned-but-undeleted WELCOME checkout still holding the slot.
 */
function isWelcomeIndexViolation(
  error: { code?: string; message?: string } | null,
): boolean {
  return (
    error?.code === '23505' &&
    (error.message ?? '').includes('projects_one_welcome_per_owner')
  )
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
        addOns?: unknown
        billingCountry?: unknown
        billingProvince?: unknown
        termsAcceptedVersion?: unknown
        code?: unknown
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

  // Add-ons (#19): strict 400 on malformed input — the deep-link parser
  // filters silently, but the payment boundary rejects. De-dupe by filtering
  // the canonical ADD_ON_VALUES order so persisted arrays are stable
  // regardless of client click order.
  const rawAddOns = body?.addOns === undefined ? [] : body.addOns
  if (
    !Array.isArray(rawAddOns) ||
    rawAddOns.some(
      (value) =>
        typeof value !== 'string' ||
        !(ADD_ON_VALUES as readonly string[]).includes(value),
    )
  ) {
    return NextResponse.json(
      { error: 'Invalid add-on selection' },
      { status: 400 },
    )
  }
  const addOns: AddOn[] = ADD_ON_VALUES.filter((value) =>
    rawAddOns.includes(value),
  )

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

  // Discount code (#25): an empty or non-string field means no code — the
  // server resolves whatever arrives (typed-but-unapplied codes included),
  // so the client-side preview is UX only, never trusted.
  const submittedCode =
    typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : null

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

  // Resolve every throwing client BEFORE reserving the discount: a throw
  // after the reservation would burn the hold with nothing left to restore
  // it (the seam contract). Stripe is needed for real payments; the service
  // client for (a) the dev-bypass born-paid insert — a system write, the
  // 20260708 insert fence 42501s client sessions creating anything but
  // unpaid pending_payment rows — and (b) catalog-code holds, whose
  // reserve/restore RPCs are EXECUTE-granted to service_role only
  // (20260715). WELCOME rides the insert-time one-per-owner index instead,
  // so welcome-only checkouts keep working without the service key. A
  // malformed code resolves the client before its 400 — accepted;
  // resolve-before-reserve is the contract.
  const devBypass = process.env.PAYMENTS_DEV_BYPASS === 'true'
  const normalizedCode = submittedCode ? submittedCode.toUpperCase() : null
  const needsServiceClient =
    devBypass ||
    (normalizedCode !== null && normalizedCode !== WELCOME_COUPON_CODE)
  let stripe: ReturnType<typeof getStripe> | null = null
  let serviceSupabase: SupabaseClient | null = null
  if (needsServiceClient) {
    try {
      serviceSupabase = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Payments not configured' },
        { status: 500 },
      )
    }
  }
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

  // Atomically reserve the order's discount (the #38 seam): a submitted code
  // is re-validated and resolved server-side (welcome per D11/D5, catalog
  // per #17) and skips the first-mix reserve — one code per order (D4); with
  // no code, the one-shot first-mix flag. Catalog codes acquire their
  // single-use/usage-limit hold here (#26/D6, the reserve_discount_code CAS
  // on the service client); the webhook finalizes consumption when payment
  // confirms. A code rejection maps to 400; only infrastructure failures
  // stay 500. Every failure path past this point must end in
  // `reservation.release()`, exactly once.
  const reserved = await reserveOrderDiscount(supabase, user.id, {
    submittedCode,
    serviceSupabase,
  })
  if (!reserved.reservation) {
    return NextResponse.json(
      { error: reserved.error },
      { status: 'rejection' in reserved ? 400 : 500 },
    )
  }
  const { reservation } = reserved
  const discountApplied = reservation.applied

  const breakdown = computeOrderPrice({
    songCount,
    addOns,
    code: reservation.code,
    buyer,
  })
  const amountCents = breakdown.total_cents
  const currency = breakdown.currency

  // A deep below-floor code (D-floor-private) can price an order under
  // Stripe's minimum charge (or at $0). Reject clearly instead of letting
  // the intent create fail into a 502 — and do NOT silently clamp upward or
  // mint a free order; neither is decided policy. Dev bypass charges 0 by
  // design and skips this.
  if (!devBypass && amountCents < STRIPE_MIN_CHARGE_CENTS) {
    await reservation.release()
    return NextResponse.json(
      {
        error:
          'That code brings the order below the minimum chargeable amount. Contact the studio.',
      },
      { status: 400 },
    )
  }

  const nowIso = new Date().toISOString()
  const orderFields = {
    song_count: songCount,
    stem_count: stemCount,
    // [] = none selected; null stays reserved for pre-#19 rows (20260724).
    add_ons: addOns,
    subtotal_cents: breakdown.subtotal_cents,
    reference_tracks: referenceTracks,
    terms_accepted_at: nowIso,
    terms_version: TERMS_VERSION,
    // 0 = computed, zero-rated (non-CA); null is reserved for rows that
    // predate tax computation (20260713 migration).
    tax_cents: breakdown.tax_cents,
    buyer_country: billingCountry,
    buyer_province: billingProvince,
    // Frozen after insert by the 20260713 trigger, like the fields above.
    applied_coupon_code: reservation.couponCode,
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
      if (isWelcomeIndexViolation(insertError)) {
        return NextResponse.json(
          { error: CODE_REJECTION_MESSAGES.welcome_in_use },
          { status: 400 },
        )
      }
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create project' },
        { status: 500 },
      )
    }

    // Born-paid and webhook-less: finalize the code's consumption inline.
    // Best-effort — a dev-only path never blocks on the ledger write.
    const { error: consumeError } = await finalizeDiscountConsumption(
      serviceSupabase,
      { id: project.id, applied_coupon_code: reservation.couponCode },
    )
    if (consumeError) {
      console.error('[checkout] dev-bypass consume failed', consumeError)
    }

    // #24 receipt: this insert is the row's only payment writer (born paid,
    // no webhook in dev bypass), so the send fires inline. Best-effort.
    await sendOrderConfirmationEmail(serviceSupabase, project.id)

    return NextResponse.json({
      projectId: project.id,
      devBypass: true,
      clientSecret: null,
      amountCents: 0,
      currency,
      discountApplied,
      appliedCouponCode: reservation.couponCode,
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
        // Always stamped, even when empty — unlike the coupon key below,
        // which omits-when-absent. Absent must keep meaning "pre-#19
        // intent" so the payment-status cross-check can skip legacy
        // intents; '' means a post-#19 order with no add-ons purchased.
        add_ons: addOns.join(','),
        tax_cents: String(breakdown.tax_cents),
        tax_region: billingProvince ? `CA-${billingProvince}` : billingCountry,
        // Stripe metadata values must be strings — omit rather than "null".
        // #26's webhook finalize reads this to consume the code on payment.
        ...(reservation.couponCode
          ? { applied_coupon_code: reservation.couponCode }
          : {}),
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
    if (isWelcomeIndexViolation(insertError)) {
      return NextResponse.json(
        { error: CODE_REJECTION_MESSAGES.welcome_in_use },
        { status: 400 },
      )
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
        add_ons: addOns.join(','),
        tax_cents: String(breakdown.tax_cents),
        tax_region: billingProvince ? `CA-${billingProvince}` : billingCountry,
        ...(reservation.couponCode
          ? { applied_coupon_code: reservation.couponCode }
          : {}),
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
    appliedCouponCode: reservation.couponCode,
    breakdown,
  })
}
