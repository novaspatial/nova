import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, status')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { fileName, fileSize, mimeType, fileType } = body

  if (!fileName || !fileSize || !mimeType) {
    return NextResponse.json(
      { error: 'fileName, fileSize, and mimeType are required' },
      { status: 400 },
    )
  }

  // Studio role check for mix uploads
  if (fileType === 'mix') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'studio') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['processing', 'mixing', 'review', 'revision'].includes(project.status)) {
      return NextResponse.json(
        { error: 'Cannot upload mixes in current project status' },
        { status: 400 },
      )
    }
  }

  const storagePath = fileType === 'mix'
    ? `${project.owner_id}/${projectId}/mixes/${fileName}`
    : `${project.owner_id}/${projectId}/${fileName}`

  // 1. Insert file record
  const { data: file, error: insertError } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      file_type: fileType || 'stem',
      storage_path: storagePath,
      upload_status: 'pending',
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insertError || !file) {
    console.error('[API /files POST] Insert Error:', insertError)
    return NextResponse.json(
      { error: insertError?.message || 'Failed to register file', details: insertError },
      { status: 500 },
    )
  }

  // 2. Create signed upload URL for Supabase Storage
  // Use upsert for mix files so studio can re-upload updated mixes
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('project-uploads')
    .createSignedUploadUrl(storagePath, { upsert: fileType === 'mix' })

  if (uploadError || !uploadData) {
    console.error('[API /files POST] Storage Signed URL Error:', uploadError)
    return NextResponse.json(
      { error: uploadError?.message || 'Failed to create upload URL', details: uploadError },
      { status: 500 },
    )
  }

  return NextResponse.json({
    fileId: file.id,
    uploadUrl: uploadData.signedUrl,
  })
}
