import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { notFoundResponse, requireApiUser } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { claimProjectPayment } from '@/lib/portal/paymentClaim'
import type { ProjectStatus } from '@/lib/portal/workflow'

type ProjectRow = {
  id: string
  owner_id: string
  status: ProjectStatus
  paid_at: string | null
  stripe_payment_intent_id: string | null
  client_deleted_at: string | null
  song_count: number | null
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
      'id, owner_id, status, paid_at, stripe_payment_intent_id, client_deleted_at, song_count',
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

  // The intent must belong to THIS row, not merely this user: deleting a
  // paid project frees its unique intent id, so a forged pending_payment
  // row could re-attach a succeeded intent. project_id is patched into the
  // metadata best-effort after insert (absent = pass, like the webhook).
  const metaProjectId =
    typeof intent.metadata?.project_id === 'string'
      ? intent.metadata.project_id
      : null
  if (metaProjectId && metaProjectId !== project.id) {
    return notFoundResponse('Project not found')
  }
  // song_count is stamped server-side at intent creation, so when it is
  // present the row must match it exactly — a re-attached intent whose
  // forged row nulls or inflates song_count is refused (fail closed; a
  // null project.song_count counts as a mismatch). This bounds the forged
  // workload to what was actually paid; it does not fully close the
  // patch-failed re-attach residual (a same-size resurrection with the
  // project_id metadata absent), which needs a DB-level floor (#42).
  const metaSongCount =
    typeof intent.metadata?.song_count === 'string'
      ? Number(intent.metadata.song_count)
      : null
  if (
    metaSongCount !== null &&
    Number.isFinite(metaSongCount) &&
    metaSongCount !== project.song_count
  ) {
    console.error('[payment-status] metadata song_count mismatch', {
      intent: intent.id,
      project: project.id,
    })
    return NextResponse.json({ paid: false, status: project.status })
  }

  if (intent.status === 'succeeded') {
    // System write: Stripe (verified above), not the session, is the
    // authority — so the claim runs on the service client. Client sessions
    // are 42501'd by the order-fields freeze and status fence by design.
    let serviceSupabase: SupabaseClient
    try {
      serviceSupabase = createServiceClient()
    } catch (err) {
      console.error('[payment-status] service client unavailable', err)
      return NextResponse.json({ paid: false, status: project.status })
    }

    const { claimed, error: updateError } = await claimProjectPayment(
      serviceSupabase,
      project,
    )

    if (updateError) {
      console.error('[payment-status] claim failed', updateError)
      return NextResponse.json({ paid: false, status: project.status })
    }

    if (claimed) {
      return NextResponse.json({ paid: true, status: claimed.status })
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
