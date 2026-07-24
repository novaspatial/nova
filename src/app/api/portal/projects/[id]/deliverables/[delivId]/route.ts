import { NextResponse, type NextRequest } from 'next/server'
import { requireApiStudioUser, requireProjectChild } from '@/lib/auth/server'
import { removeStorageObjects } from '@/lib/portal/storage'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; delivId: string }> },
) {
  const { id: projectId, delivId } = await params
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const childResult = await requireProjectChild<{ storage_path: string }>(
    auth,
    {
      projectId,
      table: 'deliverables',
      rowId: delivId,
      select: 'storage_path',
      notFoundMessage: 'Deliverable not found',
    },
  )
  if ('response' in childResult) {
    return childResult.response
  }
  const { row: deliverable } = childResult

  const { error: storageError } = await removeStorageObjects(
    supabase,
    'deliverable',
    [deliverable.storage_path],
  )

  if (storageError) {
    return NextResponse.json({ error: storageError }, { status: 500 })
  }

  const { data: deleted, error: dbError } = await supabase
    .from('deliverables')
    .delete()
    .eq('id', delivId)
    .eq('project_id', projectId)
    .select('id')

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  if (!deleted?.length) {
    return NextResponse.json({ error: 'Deliverable could not be deleted' }, { status: 403 })
  }

  return new NextResponse(null, { status: 204 })
}
