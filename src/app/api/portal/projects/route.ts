import { NextResponse } from 'next/server'
import { requireApiProfile } from '@/lib/auth/server'

// NOTE: there is deliberately no POST here. Projects are created only via
// the priced checkout route (/api/portal/projects/checkout) — an unpriced
// insert endpoint would bypass payment entirely. Removed with S1 (#16).

export async function GET() {
  const auth = await requireApiProfile()
  if ('response' in auth) {
    return auth.response
  }

  const { supabase, user, profile } = auth

  let query = supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (profile?.role === 'studio') {
    query = query.is('studio_deleted_at', null).is('archived_at', null)
  } else {
    query = query.eq('owner_id', user.id).is('client_deleted_at', null)
  }

  const { data: projects, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(projects)
}
