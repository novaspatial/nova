import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { claimProjectPayment } from '@/lib/portal/paymentClaim'
import { finalizeDiscountConsumption } from '@/lib/portal/orderDiscount'
import { sendOrderConfirmationEmail } from '@/lib/email/orderConfirmation'
import { alertMoneyPathAnomaly } from '@/lib/observability/report'
import type { ProjectStatus } from '@/lib/portal/workflow'

export const runtime = 'nodejs'

type ProjectRow = {
  id: string
  owner_id: string
  status: ProjectStatus
  paid_at: string | null
  stripe_payment_intent_id: string | null
  applied_coupon_code: string | null
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 },
    )
  }

  const rawBody = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 },
    )
  }

  if (event.type !== 'payment_intent.succeeded') {
    // Log known adjacent events, then 200 so Stripe doesn't retry.
    if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.canceled'
    ) {
      const pi = event.data.object as Stripe.PaymentIntent
      console.info('[stripe webhook]', event.type, pi.id)
    }
    return NextResponse.json({ received: true })
  }

  const intent = event.data.object as Stripe.PaymentIntent
  const supabase = createServiceClient()

  const { data: project, error: loadError } = await supabase
    .from('projects')
    .select(
      'id, owner_id, status, paid_at, stripe_payment_intent_id, applied_coupon_code',
    )
    .eq('stripe_payment_intent_id', intent.id)
    .maybeSingle<ProjectRow>()

  if (loadError) {
    console.error('[stripe webhook] project lookup failed', loadError)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!project) {
    // No matching project. Could be an intent created outside our flow.
    // Return 200 so Stripe doesn't retry forever.
    console.warn('[stripe webhook] no project for intent', intent.id)
    return NextResponse.json({ received: true })
  }

  const metaUserId =
    typeof intent.metadata?.user_id === 'string' ? intent.metadata.user_id : null
  const metaProjectId =
    typeof intent.metadata?.project_id === 'string'
      ? intent.metadata.project_id
      : null

  // A mismatch here is Stripe's verified metadata disagreeing with the
  // row we are about to mark paid — a tamper signal, not a transient
  // fault, so it alerts rather than just logging (#59). The 200 stands:
  // retrying cannot fix a disagreement.
  if (metaUserId && metaUserId !== project.owner_id) {
    alertMoneyPathAnomaly({
      kind: 'webhook_user_id_mismatch',
      intentId: intent.id,
      projectId: project.id,
      expected: project.owner_id,
      actual: metaUserId,
    })
    return NextResponse.json({ received: true })
  }
  if (metaProjectId && metaProjectId !== project.id) {
    alertMoneyPathAnomaly({
      kind: 'webhook_project_id_mismatch',
      intentId: intent.id,
      projectId: project.id,
      expected: project.id,
      actual: metaProjectId,
    })
    return NextResponse.json({ received: true })
  }

  if (project.paid_at) {
    // Replay of an already-claimed payment. Re-attempt consumption before
    // answering (#26/D6): if a prior delivery claimed the payment but died
    // before the consume landed, this early return would otherwise strand
    // the code unconsumed forever. finalizeDiscountConsumption is
    // idempotent per project, so a fully-finalized replay is a no-op.
    const { error: consumeError } = await finalizeDiscountConsumption(
      supabase,
      project,
    )
    if (consumeError) {
      console.error('[stripe webhook] consume failed on replay', consumeError)
      return NextResponse.json({ error: 'Consume failed' }, { status: 500 })
    }
    return NextResponse.json({ received: true, idempotent: true })
  }

  // Always record the payment fact; move status only along the legal edge.
  // A project that somehow advanced past pending_payment before payment
  // confirmed keeps its status instead of being dragged back to uploading.
  const { claimed, advanced, error: updateError } = await claimProjectPayment(
    supabase,
    project,
  )
  if (!advanced) {
    console.warn('[stripe webhook] project already advanced; recording paid_at only', {
      project: project.id,
      status: project.status,
    })
  }

  if (updateError) {
    console.error('[stripe webhook] project update failed', updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Post-claim finalize order: (1) consumption — MUST 500 on failure so
  // Stripe's retry loop finishes the job (the replay path above re-attempts
  // it); (2) #24 receipt — best-effort, never a 500; (3) ack.
  const { error: consumeError } = await finalizeDiscountConsumption(
    supabase,
    project,
  )
  if (consumeError) {
    console.error('[stripe webhook] consume failed', consumeError)
    return NextResponse.json({ error: 'Consume failed' }, { status: 500 })
  }

  // Only the claim winner sends (#24): the CAS fence makes the winner unique
  // across this handler, the poll route, and replays, so the receipt fires
  // exactly once. Accepted residual: a consume-fail 500 above hands the send
  // to no one — the replay path finishes the consume but never emails.
  if (claimed) {
    await sendOrderConfirmationEmail(supabase, project.id)
  }

  return NextResponse.json({ received: true })
}
