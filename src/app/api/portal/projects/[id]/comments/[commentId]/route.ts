import { NextResponse, type NextRequest } from 'next/server'
import { requireApiProfile, requireProjectChild } from '@/lib/auth/server'
import { removeStorageObjects } from '@/lib/portal/storage'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id: projectId, commentId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const childResult = await requireProjectChild<{
    id: string
    author_id: string
  }>(auth, {
    projectId,
    table: 'project_comments',
    rowId: commentId,
    select: 'id, author_id',
    authorField: 'author_id',
    notFoundMessage: 'Comment not found',
  })
  if ('response' in childResult) {
    return childResult.response
  }
  const { isStudio, isAuthor } = childResult

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
  await removeStorageObjects(supabase, 'comment_attachment', storagePaths)

  return new NextResponse(null, { status: 204 })
}
