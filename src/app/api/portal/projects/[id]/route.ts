import { NextResponse, type NextRequest } from 'next/server'
import {
  forbiddenResponse,
  getProjectOrApiNotFound,
  notFoundResponse,
  requireApiProfile,
  requireApiStudioUser,
} from '@/lib/auth/server'
import { sendProjectStatusEmail } from '@/lib/email/projectNotifications'

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

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    id,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const body = await request.json()
  const { status, deliverable_format } = body

  const validStatuses = [
    'uploading',
    'in_review',
    'processing',
    'mixing',
    'review',
    'revision',
    'approved',
    'delivered',
  ]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
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

  const { data: project, error } = await supabase
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const { data: project } = await supabase
    .from('projects')
    .select(
      'id, owner_id, client_deleted_at, studio_deleted_at, discount_applied, paid_at',
    )
    .eq('id', id)
    .single()

  if (!project) {
    return notFoundResponse('Project not found')
  }

  const canDelete = profile?.role === 'studio' || project.owner_id === user.id

  if (!canDelete) {
    return forbiddenResponse()
  }

  // If this project reserved the first-mix discount but was never paid,
  // return the reservation to the user's pool so they can retry later.
  if (project.discount_applied && !project.paid_at) {
    const { error: restoreError } = await supabase.rpc(
      'restore_first_mix_discount',
      { p_user_id: project.owner_id },
    )
    if (restoreError) {
      console.error(
        '[DELETE /projects/:id] discount restore failed',
        restoreError,
      )
    }
  }

  const [filesResult, deliverablesResult] = await Promise.all([
    supabase
      .from('project_files')
      .select('storage_path')
      .eq('project_id', id),
    supabase
      .from('deliverables')
      .select('storage_path')
      .eq('project_id', id),
  ])

  if (filesResult.error) {
    return NextResponse.json({ error: filesResult.error.message }, { status: 500 })
  }

  if (deliverablesResult.error) {
    return NextResponse.json(
      { error: deliverablesResult.error.message },
      { status: 500 },
    )
  }

  const uploadPaths = (filesResult.data || []).map((file) => file.storage_path)
  const deliverablePaths = (deliverablesResult.data || []).map(
    (deliverable) => deliverable.storage_path,
  )

  if (uploadPaths.length > 0) {
    const { error } = await supabase.storage
      .from('project-uploads')
      .remove(uploadPaths)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (deliverablePaths.length > 0) {
    const { error } = await supabase.storage
      .from('project-deliverables')
      .remove(deliverablePaths)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: deletedProject, error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .select('id')
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

  return NextResponse.json({ success: true, hidden: false, deleted: true })
}
