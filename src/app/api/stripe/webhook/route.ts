import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { claimProjectPayment } from '@/lib/portal/paymentClaim'
import type { ProjectStatus } from '@/lib/portal/workflow'

export const runtime = 'nodejs'

type ProjectRow = {
  id: string
  owner_id: string
  status: ProjectStatus
  paid_at: string | null
  stripe_payment_intent_id: string | null
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
    .select('id, owner_id, status, paid_at, stripe_payment_intent_id')
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

  if (metaUserId && metaUserId !== project.owner_id) {
    console.error(
      '[stripe webhook] metadata user_id mismatch',
      { intent: intent.id, meta: metaUserId, owner: project.owner_id },
    )
    return NextResponse.json({ received: true })
  }
  if (metaProjectId && metaProjectId !== project.id) {
    console.error(
      '[stripe webhook] metadata project_id mismatch',
      { intent: intent.id, meta: metaProjectId, project: project.id },
    )
    return NextResponse.json({ received: true })
  }

  if (project.paid_at) {
    return NextResponse.json({ received: true, idempotent: true })
  }

  // Always record the payment fact; move status only along the legal edge.
  // A project that somehow advanced past pending_payment before payment
  // confirmed keeps its status instead of being dragged back to uploading.
  const { advanced, error: updateError } = await claimProjectPayment(
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

  return NextResponse.json({ received: true })
}
