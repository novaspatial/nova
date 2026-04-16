import { NextResponse } from 'next/server'
import { requireApiProfile } from '@/lib/auth/server'

export async function GET() {
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }

  const { supabase, user, profile } = auth
  const isStudio = profile?.role === 'studio'

  let query = supabase
    .from('projects')
    .select('id, status')

  if (isStudio) {
    query = query.eq('status', 'in_review').is('studio_deleted_at', null)
  } else {
    query = query.eq('owner_id', user.id).is('client_deleted_at', null)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    role: isStudio ? 'studio' : 'client',
    projects: (data ?? []).map((p) => ({ id: p.id, status: p.status })),
  })
}
