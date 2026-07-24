import { NextResponse, type NextRequest } from 'next/server'
import {
  forbiddenResponse,
  getProjectOrApiNotFound,
  requireApiProfile,
  requireApiStudioUser,
} from '@/lib/auth/server'
import { sendProjectStatusEmail } from '@/lib/email/projectNotifications'
import { cleanupProjectArtifacts } from '@/lib/portal/projectCleanup'
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
  const [filesResult, commentsResult, deliverablesResult] = await Promise.all([
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
    supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    ...project,
    files: filesResult.data || [],
    comments: commentsResult.data || [],
    deliverables: deliverablesResult.data || [],
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
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    status: ProjectStatus
  }>(supabase, id, 'id, status', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const currentStatus = projectResult.project.status

  const body = await request.json()
  const { status, deliverable_format } = body

  if (!isProjectStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Legality check must precede the deliverables side-write below, so an
  // illegal jump to `approved` can't mutate deliverables first.
  if (!canTransition(currentStatus, status, 'studio')) {
    return NextResponse.json(
      { error: `Cannot change status from ${currentStatus} to ${status}` },
      { status: 400 },
    )
  }

  if (status === 'approved' && deliverable_format) {
    const { error: fmtError } = await supabase
      .from('deliverables')
      .update({ format: deliverable_format, approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('project_id', id)

    if (fmtError) {
      return NextResponse.json({ error: fmtError.message }, { status: 500 })
    }
  }

  // Compare-and-swap on the status read above: a concurrent transition
  // makes this a 0-row update instead of silently clobbering it.
  const { data: project, error } = await supabase
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
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
  }>(supabase, id, 'id, owner_id', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const canDelete = profile?.role === 'studio' || project.owner_id === user.id

  if (!canDelete) {
    return forbiddenResponse()
  }

  // Sweep storage objects (uploads, comment attachments, deliverables)
  // before the row + children cascade.
  const { error: cleanupError } = await cleanupProjectArtifacts(supabase, project)
  if (cleanupError) {
    return NextResponse.json({ error: cleanupError }, { status: 500 })
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
  // duplicate delete can't double-restore (#26). The catalog restore needs
  // the service client (20260715 grants); when the key is absent the seam
  // logs and skips — never blocks the completed delete.
  let serviceSupabase = null
  try {
    serviceSupabase = createServiceClient()
  } catch {
    serviceSupabase = null
  }
  await restoreUnpaidOrderDiscount(supabase, deletedProject, {
    serviceSupabase,
  })

  return NextResponse.json({ success: true, hidden: false, deleted: true })
}
