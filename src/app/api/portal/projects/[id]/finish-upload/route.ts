import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function POST(
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

  // Update project status to 'processing'
  const { error } = await supabase
    .from('projects')
    .update({ status: 'processing' })
    .eq('id', projectId)
    .eq('owner_id', user.id)

  if (error) {
    console.error('[API /projects/finish-upload POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update project status' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
