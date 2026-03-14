import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiUser,
} from '@/lib/auth/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; delivId: string }> },
) {
  const { id: projectId, delivId } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('storage_path, file_name')
    .eq('id', delivId)
    .eq('project_id', projectId)
    .single()

  if (!deliverable) {
    return NextResponse.json(
      { error: 'Deliverable not found' },
      { status: 404 },
    )
  }

  // Generate signed download URL (valid for 1 hour)
  const { data: urlData, error } = await supabase.storage
    .from('project-deliverables')
    .createSignedUrl(deliverable.storage_path, 3600)

  if (error || !urlData) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate download URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: urlData.signedUrl })
}
