import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; delivId: string }> },
) {
  const { id: projectId, delivId } = await params
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

  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('storage_path, file_name')
    .eq('id', delivId)
    .eq('project_id', projectId)
    .single()

  if (!deliverable) {
    return NextResponse.json(
      { error: 'Deliverable not found' },
      { status: 404 },
    )
  }

  // Generate signed download URL (valid for 1 hour)
  const { data: urlData, error } = await supabase.storage
    .from('project-deliverables')
    .createSignedUrl(deliverable.storage_path, 3600)

  if (error || !urlData) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate download URL' },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: urlData.signedUrl })
}
