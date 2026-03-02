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

  const { data: comments, error } = await supabase
    .from('project_comments')
    .select(
      '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(comments)
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

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const reqBody = await request.json()
  const { body, timestampMs, parentId } = reqBody

  if (!body || typeof body !== 'string') {
    return NextResponse.json(
      { error: 'Comment body is required' },
      { status: 400 },
    )
  }

  const { data: comment, error } = await supabase
    .from('project_comments')
    .insert({
      project_id: projectId,
      author_id: user.id,
      body: body.trim(),
      timestamp_ms: timestampMs ?? null,
      parent_id: parentId ?? null,
    })
    .select(
      '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
    )
    .single()

  if (error || !comment) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create comment' },
      { status: 500 },
    )
  }

  return NextResponse.json(comment)
}
