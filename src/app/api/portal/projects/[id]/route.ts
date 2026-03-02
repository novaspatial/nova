import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Fetch related data
  const [filesResult, commentsResult, deliverablesResult] = await Promise.all([
    supabase
      .from('project_files')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_comments')
      .select(
        '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
      )
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('deliverables')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    ...project,
    files: filesResult.data || [],
    comments: commentsResult.data || [],
    deliverables: deliverablesResult.data || [],
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
  const { status } = body

  const validStatuses = [
    'uploading',
    'processing',
    'mixing',
    'review',
    'revision',
    'approved',
    'delivered',
  ]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: project, error } = await supabase
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(project)
}
