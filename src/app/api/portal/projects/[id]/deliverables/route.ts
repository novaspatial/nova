import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiStudioUser,
  requireApiUser,
} from '@/lib/auth/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth

  const { data: deliverables, error } = await supabase
    .from('deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(deliverables)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const projectResult = await getProjectOrApiNotFound<{
    id: string
    owner_id: string
  }>(supabase, projectId, 'id, owner_id')
  if ('response' in projectResult) {
    return projectResult.response
  }
  const { project } = projectResult

  const body = await request.json()
  const { fileName, fileSize, format } = body

  if (!fileName || !fileSize || !format) {
    return NextResponse.json(
      { error: 'fileName, fileSize, and format are required' },
      { status: 400 },
    )
  }

  const storagePath = `${project.owner_id}/${projectId}/${fileName}`

  // 1. Insert deliverable record
  const { data: deliverable, error: insertError } = await supabase
    .from('deliverables')
    .insert({
      project_id: projectId,
      file_name: fileName,
      file_size: fileSize,
      storage_path: storagePath,
      format,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .select()
    .single()

  if (insertError || !deliverable) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create deliverable' },
      { status: 500 },
    )
  }

  // 2. Create signed upload URL for Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('project-deliverables')
    .createSignedUploadUrl(storagePath, { upsert: true })

  if (uploadError || !uploadData) {
    console.error('[API /deliverables POST] Storage Signed URL Error:', uploadError)
    return NextResponse.json(
      { error: uploadError?.message || 'Failed to create upload URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    deliverableId: deliverable.id,
    uploadUrl: uploadData.signedUrl,
  })
}
