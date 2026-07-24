import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getProjectOrApiNotFound,
  notFoundResponse,
  requireApiUser,
} from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { claimProjectPayment } from '@/lib/portal/paymentClaim'
import {
  finalizeDiscountConsumption,
  WELCOME_COUPON_CODE,
} from '@/lib/portal/orderDiscount'
import { sendOrderConfirmationEmail } from '@/lib/email/orderConfirmation'
import type { ProjectStatus } from '@/lib/portal/workflow'
import type { AddOn } from '@/types/portal'

type ProjectRow = {
  id: string
  owner_id: string
  status: ProjectStatus
  paid_at: string | null
  stripe_payment_intent_id: string | null
  song_count: number | null
  add_ons: AddOn[] | null
  applied_coupon_code: string | null
}

/**
 * Best-effort consumption finalize for the poll path (#26/D6): payment is
 * already a fact here, so a failed (or service-key-less) consume must never
 * block the `paid: true` answer — the webhook's 500-retry loop is the
 * durable finalizer, and in webhook-less dev the next poll retries.
 */
async function finalizeConsumptionBestEffort(project: {
  id: string
  applied_coupon_code: string | null
}): Promise<void> {
  if (
    !project.applied_coupon_code ||
    project.applied_coupon_code === WELCOME_COUPON_CODE
  ) {
    return
  }
  let serviceSupabase: SupabaseClient
  try {
    serviceSupabase = createServiceClient()
  } catch {
    return
  }
  const { error } = await finalizeDiscountConsumption(serviceSupabase, project)
  if (error) {
    console.error('[payment-status] consume failed', error)
  }
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

  // viewerRole omitted = client-side visibility (client_deleted_at), matching
  // this poller's session-only auth. Ownership stays an explicit 404 below.
  const projectResult = await getProjectOrApiNotFound<ProjectRow>(
    supabase,
    id,
    'id, owner_id, status, paid_at, stripe_payment_intent_id, song_count, add_ons, applied_coupon_code',
  )
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  if (project.owner_id !== user.id) {
    return notFoundResponse('Project not found')
  }

  if (project.paid_at) {
    // Paid rows can still carry an unfinalized consume (claim landed, the
    // finalizer died, and no webhook retry reached us — e.g. webhook-less
    // dev). Idempotent, so repeated polls are harmless.
    await finalizeConsumptionBestEffort(project)
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
  // add_ons is stamped server-side at intent creation — always, so '' means
  // a post-#19 order with none purchased and absent means a pre-#19 intent
  // (pass, like project_id). When present the row must match it exactly: a
  // forged row bolting a 48h rush onto a rush-less paid intent is refused,
  // and a forged-null row counts as 'none' so it fails against any paid
  // add-on. Both sides use the canonical ADD_ON_VALUES order (#19).
  const metaAddOns =
    typeof intent.metadata?.add_ons === 'string'
      ? intent.metadata.add_ons
      : null
  if (metaAddOns !== null && metaAddOns !== (project.add_ons ?? []).join(',')) {
    console.error('[payment-status] metadata add_ons mismatch', {
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

    // Payment is confirmed whether we won the claim or the webhook did —
    // finalize consumption either way (idempotent; best-effort here).
    await finalizeConsumptionBestEffort(project)

    if (claimed) {
      // This poll won the claim (delayed webhook), so the receipt (#24)
      // fires here — the webhook's replay path never sends, and the CAS
      // fence keeps the winner unique. Best-effort, on the service client
      // (the profiles-join lookup is a system read).
      await sendOrderConfirmationEmail(serviceSupabase, project.id)
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
