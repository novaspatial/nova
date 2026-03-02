import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function GET() {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let query = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (profile?.role !== 'studio') {
    query = query.eq('owner_id', user.id)
  }

  const { data: projects, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { title, format, notes } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json(
      { error: 'Title is required' },
      { status: 400 },
    )
  }

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      title: title.trim(),
      format: format || 'atmos',
      notes: notes || null,
      status: 'uploading',
    })
    .select()
    .single()

  if (insertError || !project) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create project' },
      { status: 500 },
    )
  }

  return NextResponse.json(project)
}
