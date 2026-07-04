import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'
import { sendProjectStatusEmail } from '@/lib/email/projectNotifications'
import { canTransition, type ProjectStatus } from '@/lib/portal/workflow'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const { data: project, error: loadError } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .maybeSingle<{ id: string; status: ProjectStatus }>()

  if (loadError) {
    console.error('[API /projects/finish-upload POST] Load error:', loadError)
    return NextResponse.json(
      { error: 'Failed to load project' },
      { status: 500 },
    )
  }
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Double-submitting is a no-op, not an error (confirm dialogs re-fire).
  if (project.status === 'in_review') {
    return NextResponse.json({ success: true })
  }

  if (!canTransition(project.status, 'in_review', 'client')) {
    return NextResponse.json(
      { error: 'Project files can only be submitted while uploading' },
      { status: 400 },
    )
  }

  // Compare-and-swap on the status read above so a concurrent transition
  // can't be overwritten; a lost race means someone else already moved the
  // project, so succeed without re-updating or emailing.
  const { data: updated, error } = await supabase
    .from('projects')
    .update({ status: 'in_review' })
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .eq('status', project.status)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[API /projects/finish-upload POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update project status' },
      { status: 500 },
    )
  }

  if (updated) {
    await sendProjectStatusEmail(supabase, projectId, 'in_review', new URL(request.url).origin)
  }

  return NextResponse.json({ success: true })
}
