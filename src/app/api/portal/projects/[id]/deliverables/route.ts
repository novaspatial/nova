import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function GET(
  _request: NextRequest,
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

  // Check studio role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'studio') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

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
