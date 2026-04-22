import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { computePrice } from '@/lib/stripe/pricing'

const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_PENDING = 3

export async function POST(request: NextRequest) {
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const body = await request.json().catch(() => null) as
    | { title?: unknown; format?: unknown; notes?: unknown }
    | null

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const format = typeof body?.format === 'string' ? body.format : 'atmos'
  const notes = typeof body?.notes === 'string' ? body.notes : null

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

  // Atomically reserve the first-mix discount (flip true -> false).
  const { data: reservedData, error: reserveError } = await supabase.rpc(
    'reserve_first_mix_discount',
    { p_user_id: user.id },
  )
  if (reserveError) {
    return NextResponse.json({ error: reserveError.message }, { status: 500 })
  }
  const discountApplied = reservedData === true

  const devBypass = process.env.PAYMENTS_DEV_BYPASS === 'true'

  if (devBypass) {
    const nowIso = new Date().toISOString()
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        title,
        format,
        notes,
        status: 'uploading',
        amount_cents: 0,
        currency: 'usd',
        discount_applied: discountApplied,
        paid_at: nowIso,
      })
      .select('id')
      .single()

    if (insertError || !project) {
      if (discountApplied) {
        await supabase.rpc('restore_first_mix_discount', { p_user_id: user.id })
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
      currency: 'usd',
      discountApplied,
    })
  }

  const { amountCents, currency } = computePrice(discountApplied)

  const stripe = getStripe()

  let intent
  try {
    intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: user.id,
        discount_applied: String(discountApplied),
      },
    })
  } catch (err) {
    if (discountApplied) {
      await supabase.rpc('restore_first_mix_discount', { p_user_id: user.id })
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
      await supabase.rpc('restore_first_mix_discount', { p_user_id: user.id })
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
  })
}
