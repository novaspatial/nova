import { NextResponse, type NextRequest } from 'next/server'
import {
  getProjectOrApiNotFound,
  requireApiStudioUser,
} from '@/lib/auth/server'

// POST → archive the project (studio only)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return setArchived(params, true)
}

// DELETE → unarchive / restore the project (studio only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return setArchived(params, false)
}

async function setArchived(
  params: Promise<{ id: string }>,
  archived: boolean,
) {
  const { id } = await params
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, profile } = auth

  const projectResult = await getProjectOrApiNotFound<{ id: string }>(
    supabase,
    id,
    'id',
    profile?.role,
  )
  if ('response' in projectResult) {
    return projectResult.response
  }

  const { data: project, error } = await supabase
    .from('projects')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, archived_at')
    .single()

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update project' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, archived })
}
