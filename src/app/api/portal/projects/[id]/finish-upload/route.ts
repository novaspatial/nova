import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

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
