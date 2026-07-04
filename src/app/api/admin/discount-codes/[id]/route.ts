import { NextResponse, type NextRequest } from 'next/server'
import { requireApiStudioUser } from '@/lib/auth/server'

// Expire/re-arm a code. Deactivation is the "expire now" path from the
// admin list; reactivation is the undo. Value/kind edits are deliberately
// not supported — issue a new code instead, so a code's meaning never
// changes under a client who saw it advertised.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiStudioUser()
  if ('response' in auth) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  const body = await request.json().catch(() => null) as
    | { active?: unknown }
    | null

  if (typeof body?.active !== 'boolean') {
    return NextResponse.json(
      { error: 'Body must include active: true|false' },
      { status: 400 },
    )
  }

  const { data: updated, error } = await supabase
    .from('discount_codes')
    .update({ active: body.active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !updated) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to update code' },
      { status: 500 },
    )
  }

  return NextResponse.json(updated)
}
