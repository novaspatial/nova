import { NextResponse, type NextRequest } from 'next/server'
import { notFoundResponse, requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { canTransition, type ProjectStatus } from '@/lib/portal/workflow'

type ProjectRow = {
  id: string
  owner_id: string
  status: ProjectStatus
  paid_at: string | null
  stripe_payment_intent_id: string | null
  client_deleted_at: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      'id, owner_id, status, paid_at, stripe_payment_intent_id, client_deleted_at',
    )
    .eq('id', id)
    .maybeSingle<ProjectRow>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!project || project.client_deleted_at) {
    return notFoundResponse('Project not found')
  }
  if (project.owner_id !== user.id) {
    return notFoundResponse('Project not found')
  }

  if (project.paid_at) {
    return NextResponse.json({
      paid: true,
      status: project.status,
    })
  }

  if (!project.stripe_payment_intent_id) {
    return NextResponse.json({ paid: false, status: project.status })
  }

  // Defensive claim path: if the webhook is delayed, verify with Stripe
  // and apply the same state update idempotently.
  const stripe = getStripe()
  let intent
  try {
    intent = await stripe.paymentIntents.retrieve(
      project.stripe_payment_intent_id,
    )
  } catch (err) {
    console.error('[payment-status] stripe retrieve failed', err)
    return NextResponse.json({ paid: false, status: project.status })
  }

  const metaUserId =
    typeof intent.metadata?.user_id === 'string' ? intent.metadata.user_id : null
  if (metaUserId && metaUserId !== project.owner_id) {
    return notFoundResponse('Project not found')
  }

  if (intent.status === 'succeeded') {
    // Known-dead write path: since 20260702 the order-fields freeze trigger
    // raises 42501 when a client session writes paid_at, so this update
    // fails and the route reports paid:false until the webhook lands. The
    // fix must move this claim to a service-role context — the DB status
    // fence deliberately excludes client pending_payment→uploading.
    const shouldAdvance = canTransition(project.status, 'uploading', 'system')
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        ...(shouldAdvance ? { status: 'uploading' as const } : {}),
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)
      .is('paid_at', null)
      .select('status, paid_at')
      .maybeSingle()

    if (updateError) {
      console.error('[payment-status] update failed', updateError)
      return NextResponse.json({ paid: false, status: project.status })
    }

    if (updated) {
      return NextResponse.json({ paid: true, status: updated.status })
    }
    // Another caller (webhook) beat us to it; re-read.
    const { data: refreshed } = await supabase
      .from('projects')
      .select('status, paid_at')
      .eq('id', project.id)
      .maybeSingle<{ status: string; paid_at: string | null }>()
    return NextResponse.json({
      paid: Boolean(refreshed?.paid_at),
      status: refreshed?.status ?? project.status,
    })
  }

  return NextResponse.json({ paid: false, status: project.status })
}
