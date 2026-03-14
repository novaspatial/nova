import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  // Only studio can download client stems via this endpoint
  if (profile?.role !== 'studio') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: file } = await supabase
    .from('project_files')
    .select('storage_path, file_name, file_type')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const { data: urlData, error } = await supabase.storage
    .from('project-uploads')
    .createSignedUrl(file.storage_path, 3600, {
      download: file.file_name,
    })

  if (error || !urlData) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate download URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: urlData.signedUrl })
}
