import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiStudioUser,
} from '@/lib/auth/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; delivId: string }> },
) {
  const { id: projectId, delivId } = await params
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('storage_path')
    .eq('id', delivId)
    .eq('project_id', projectId)
    .single()

  if (!deliverable) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 })
  }

  const { error: storageError } = await supabase.storage
    .from('project-deliverables')
    .remove([deliverable.storage_path])

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  const { error: dbError } = await supabase
    .from('deliverables')
    .delete()
    .eq('id', delivId)
    .eq('project_id', projectId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
