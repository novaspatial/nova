import { NextResponse, type NextRequest } from 'next/server'
import { getProjectOrApiNotFound, requireApiProfile } from '@/lib/auth/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    status: string
  }>(supabase, projectId, 'id, status', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const { data: file } = await supabase
    .from('project_files')
    .select('storage_path, uploaded_by')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const isStudio = profile?.role === 'studio'
  const isOwner = file.uploaded_by === user.id
  const clientCanDelete = isOwner && project.status === 'uploading'

  if (!isStudio && !clientCanDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: storageError } = await supabase.storage
    .from('project-uploads')
    .remove([file.storage_path])

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
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
