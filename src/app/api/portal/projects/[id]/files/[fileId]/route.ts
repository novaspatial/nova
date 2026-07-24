import { NextResponse, type NextRequest } from 'next/server'
import { requireApiProfile, requireProjectChild } from '@/lib/auth/server'
import { removeStorageObjects } from '@/lib/portal/storage'
import { canUploadStems, type ProjectStatus } from '@/lib/portal/workflow'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const childResult = await requireProjectChild<
    { storage_path: string; uploaded_by: string },
    { id: string; owner_id: string; status: ProjectStatus }
  >(auth, {
    projectId,
    table: 'project_files',
    rowId: fileId,
    select: 'storage_path, uploaded_by',
    authorField: 'uploaded_by',
    notFoundMessage: 'File not found',
    projectSelect: 'id, owner_id, status',
  })
  if ('response' in childResult) {
    return childResult.response
  }
  const { project, row: file, isStudio, isAuthor } = childResult

  // Clients may reshape their upload only while stems are still uploadable.
  const clientCanDelete = isAuthor && canUploadStems(project.status)

  if (!isStudio && !clientCanDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: storageError } = await removeStorageObjects(supabase, 'stem', [
    file.storage_path,
  ])

  if (storageError) {
    return NextResponse.json({ error: storageError }, { status: 500 })
  }

  const { error: dbError } = await supabase
    .from('project_files')
    .delete()
    .eq('id', fileId)
    .eq('project_id', projectId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
