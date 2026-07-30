import { NextResponse, type NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/auth/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: projectId, fileId } = await params
  const auth = await requireApiUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase, user } = auth

  const { data: file } = await supabase
    .from('project_files')
    .select('id, uploaded_by, upload_status')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Only the registrant closes their own upload (#59): the row is created
  // by whoever registered it, and confirming someone else's is never part
  // of the register -> PUT -> confirm dance. RLS already scopes the row to
  // the project; this scopes the transition to its author.
  if (file.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Confirm is the pending -> uploaded edge only. Re-confirming an already
  // uploaded row is a harmless no-op, but nothing else may be flipped.
  if (file.upload_status === 'uploaded') {
    return NextResponse.json({ status: 'uploaded' })
  }
  if (file.upload_status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot confirm a file in state ${file.upload_status}` },
      { status: 400 },
    )
  }

  await supabase
    .from('project_files')
    .update({ upload_status: 'uploaded' })
    .eq('id', fileId)
    .eq('upload_status', 'pending')

  return NextResponse.json({ status: 'uploaded' })
}
