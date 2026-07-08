import type { SupabaseClient } from '@supabase/supabase-js'
import { canTransition, type ProjectStatus } from '@/lib/portal/workflow'

export type PaymentClaimResult = {
  /** Row as claimed, or null when another writer already set paid_at. */
  claimed: { status: ProjectStatus } | null
  /** True when the write included the pending_payment -> uploading advance. */
  advanced: boolean
  error: { message: string } | null
}

/**
 * Record a confirmed payment on a project: set paid_at and, when the
 * lifecycle allows it, advance pending_payment -> uploading. Idempotent —
 * the write is fenced on `paid_at is null`, so concurrent claimants (the
 * Stripe webhook and the payment-status poll) race safely and the loser
 * gets `claimed: null`.
 *
 * This is a system write: the authority behind it is a Stripe fact the
 * caller has already verified, never the user session. Callers must pass
 * the service-role client — client sessions are rejected with 42501 by the
 * order-fields freeze (20260702) and the status fence (20260705) by design.
 */
export async function claimProjectPayment(
  supabase: SupabaseClient,
  project: { id: string; status: ProjectStatus },
): Promise<PaymentClaimResult> {
  const now = new Date().toISOString()
  const advanced = canTransition(project.status, 'uploading', 'system')
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...(advanced ? { status: 'uploading' as const } : {}),
      paid_at: now,
      updated_at: now,
    })
    .eq('id', project.id)
    .is('paid_at', null)
    .select('status')
    .maybeSingle<{ status: ProjectStatus }>()
  return { claimed: data, advanced, error }
}
