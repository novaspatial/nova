import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiProfile,
} from '@/lib/auth/server'
import { createUpload } from '@/lib/portal/storage'

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

  const result = await createUpload(supabase, 'comment_attachment', {
    projectId,
    ownerId: project.owner_id,
    fileName,
    fileSize,
    mimeType,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    storagePath: result.storagePath,
    uploadUrl: result.uploadUrl,
  })
}
