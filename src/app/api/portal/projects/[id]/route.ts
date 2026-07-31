import { NextResponse, type NextRequest } from 'next/server'
import {
  forbiddenResponse,
  getProjectOrApiNotFound,
  requireApiProfile,
  requireApiStudioUser,
} from '@/lib/auth/server'
import { sendProjectStatusEmail } from '@/lib/email/projectNotifications'
import {
  collectProjectStoragePaths,
  removeProjectStorageObjects,
} from '@/lib/portal/projectCleanup'
import { restoreUnpaidOrderDiscount } from '@/lib/portal/orderDiscount'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import {
  canTransition,
  isProjectStatus,
  type ProjectStatus,
} from '@/lib/portal/workflow'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<Record<string, unknown>>(
    supabase,
    id,
    '*',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  // Fetch related data
  const [filesResult, commentsResult] = await Promise.all([
    supabase
      .from('project_files')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_comments')
      .select(
        '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
      )
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    ...project,
    files: filesResult.data || [],
    comments: commentsResult.data || [],
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    status: ProjectStatus
  }>(supabase, id, 'id, status', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const currentStatus = projectResult.project.status

  const body = await request.json()
  const { status } = body

  if (!isProjectStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  if (!canTransition(currentStatus, status, 'studio')) {
    return NextResponse.json(
      { error: `Cannot change status from ${currentStatus} to ${status}` },
      { status: 400 },
    )
  }

  const stampedAt = new Date().toISOString()
  const update: {
    status: ProjectStatus
    updated_at: string
    delivered_at?: string
  } = { status, updated_at: stampedAt }
  // Entering 'delivered' stamps the delivery anchor the 90-day retention
  // purge counts from (#27, D7). Only this transition touches it.
  if (status === 'delivered') {
    update.delivered_at = stampedAt
  }

  // Compare-and-swap on the status read above: a concurrent transition
  // makes this a 0-row update instead of silently clobbering it.
  const { data: project, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .eq('status', currentStatus)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!project) {
    return NextResponse.json(
      { error: 'Project status changed concurrently. Reload and retry.' },
      { status: 409 },
    )
  }

  await sendProjectStatusEmail(supabase, id, status, new URL(request.url).origin)

  return NextResponse.json(project)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    owner_id: string
    paid_at: string | null
  }>(supabase, id, 'id, owner_id, paid_at', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const isStudio = profile?.role === 'studio'
  const canDelete = isStudio || project.owner_id === user.id

  if (!canDelete) {
    return forbiddenResponse()
  }

  // A paid Project is the order/consent/tax record — the row survives even
  // the 90-day purge (#48). Clients may only delete an unpaid checkout;
  // Studio keeps the override. The DB fence (20260730) is the floor.
  if (!isStudio && project.paid_at) {
    return NextResponse.json(
      {
        error:
          'A paid project cannot be deleted. Contact the studio to cancel or request a refund.',
      },
      { status: 403 },
    )
  }

  // Read the storage paths while the child rows still exist — they cascade
  // away with the project row, and the objects they point at do not (#48).
  const { paths: storagePaths, error: collectError } =
    await collectProjectStoragePaths(supabase, project)
  if (collectError) {
    return NextResponse.json({ error: collectError }, { status: 500 })
  }

  const { data: deletedProject, error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .select('id, owner_id, discount_applied, paid_at, applied_coupon_code')
    .single()

  if (deleteError || !deletedProject) {
    return NextResponse.json(
      {
        error:
          deleteError?.message ||
          'Project could not be deleted. Ensure delete policies are applied.',
      },
      { status: 500 },
    )
  }

  // Return any unpaid discount hold (first-mix flag or catalog code) off
  // the DELETE-RETURNING row — the delete is the CAS, so a concurrent
  // duplicate delete can't double-restore (#26). Both restores need the
  // service client (20260731 grants); when the key is absent the seam
  // logs and skips — never blocks the completed delete.
  let serviceSupabase = null
  try {
    serviceSupabase = createServiceClient()
  } catch {
    serviceSupabase = null
  }
  await restoreUnpaidOrderDiscount(serviceSupabase, deletedProject)

  // Sweep last: the row is already gone, so a storage failure is logged,
  // never surfaced — a 500 here would invite a retry of a delete that
  // already committed, and orphaned objects are recoverable.
  const { error: sweepError } = await removeProjectStorageObjects(
    supabase,
    storagePaths,
  )
  if (sweepError) {
    console.error('[portal] Storage sweep failed after project delete:', {
      projectId: id,
      error: sweepError,
    })
  }

  return NextResponse.json({ success: true, hidden: false, deleted: true })
}
