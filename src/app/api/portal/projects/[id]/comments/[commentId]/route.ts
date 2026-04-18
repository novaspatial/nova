import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id: projectId, commentId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: comment } = await supabase
    .from('project_comments')
    .select('id, author_id')
    .eq('id', commentId)
    .eq('project_id', projectId)
    .single()

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isStudio = profile?.role === 'studio'
  const isAuthor = comment.author_id === user.id
  if (!isStudio && !isAuthor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: attachmentRows, error: attachmentLookupError } = await supabase
    .from('project_comment_attachments')
    .select('storage_path')
    .eq('comment_id', commentId)

  if (attachmentLookupError) {
    return NextResponse.json(
      { error: attachmentLookupError.message },
      { status: 500 },
    )
  }

  const { data: deleted, error: dbError } = await supabase
    .from('project_comments')
    .delete()
    .eq('id', commentId)
    .eq('project_id', projectId)
    .select('id')

  if (dbError) {
    // parent_id FK has no cascade — replies block parent deletion.
    if ((dbError as { code?: string }).code === '23503') {
      return NextResponse.json(
        { error: 'Delete replies before removing this comment' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // RLS rejects quietly by returning zero rows. Surface that as a 403 so the
  // client doesn't treat it as a success and race against router.refresh().
  if (!deleted?.length) {
    return NextResponse.json(
      { error: 'Comment could not be deleted' },
      { status: 403 },
    )
  }

  const storagePaths = (attachmentRows ?? []).map((row) => row.storage_path)
  if (storagePaths.length > 0) {
    await supabase.storage.from('project-uploads').remove(storagePaths)
  }

  return new NextResponse(null, { status: 204 })
}
