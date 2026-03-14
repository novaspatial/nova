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
  const { supabase } = auth

  const { data: file } = await supabase
    .from('project_files')
    .select('id')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  await supabase
    .from('project_files')
    .update({ upload_status: 'uploaded' })
    .eq('id', fileId)

  return NextResponse.json({ status: 'uploaded' })
}
