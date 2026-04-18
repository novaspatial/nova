import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id: projectId, attachmentId } = await params
  const auth = await requireApiProfile()
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

  const { data: attachment, error: fetchError } = await supabase
    .from('project_comment_attachments')
    .select('storage_path, file_name')
    .eq('id', attachmentId)
    .eq('project_id', projectId)
    .single()

  if (fetchError || !attachment) {
    return NextResponse.json(
      { error: 'Attachment not found' },
      { status: 404 },
    )
  }

  const { data: urlData, error } = await supabase.storage
    .from('project-uploads')
    .createSignedUrl(attachment.storage_path, 3600, {
      download: attachment.file_name,
    })

  if (error || !urlData) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate download URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: urlData.signedUrl })
}
