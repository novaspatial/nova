import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    owner_id: string
  }>(supabase, projectId, 'id, owner_id', profile?.role)
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const body = await request.json().catch(() => ({}))
  const { fileName, fileSize, mimeType } = body as {
    fileName?: string
    fileSize?: number
    mimeType?: string
  }

  if (!fileName || typeof fileSize !== 'number' || !mimeType) {
    return NextResponse.json(
      { error: 'fileName, fileSize, and mimeType are required' },
      { status: 400 },
    )
  }

  const attachmentUuid = crypto.randomUUID()
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${project.owner_id}/${projectId}/comments/${attachmentUuid}/${safeFileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('project-uploads')
    .createSignedUploadUrl(storagePath)

  if (uploadError || !uploadData) {
    return NextResponse.json(
      {
        error: uploadError?.message || 'Failed to create upload URL',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    storagePath,
    uploadUrl: uploadData.signedUrl,
  })
}
