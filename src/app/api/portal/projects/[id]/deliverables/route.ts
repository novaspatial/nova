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

  const body = await request.json()
  const { fileName, fileSize, storagePath, format } = body

  if (!fileName || !fileSize || !storagePath || !format) {
    return NextResponse.json(
      { error: 'fileName, fileSize, storagePath, and format are required' },
      { status: 400 },
    )
  }

  const { data: deliverable, error } = await supabase
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

  if (error || !deliverable) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create deliverable' },
      { status: 500 },
    )
  }

  return NextResponse.json(deliverable)
}
