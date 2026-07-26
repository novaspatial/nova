import { NextResponse, type NextRequest } from 'next/server'

import { purgeExpiredDeliveredProjects } from '@/lib/portal/retentionPurge'
import { createServiceClient } from '@/lib/supabase/supabaseService'

// The D7 retention entrypoint, invoked by the Vercel Cron in vercel.json.
// Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is
// set; the route fails closed (500) without it so an undeployed secret can
// never leave the purge publicly triggerable.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 },
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Service client unavailable' },
      { status: 500 },
    )
  }

  const result = await purgeExpiredDeliveredProjects(supabase)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  if (result.failures.length > 0) {
    console.error('[purge-delivered] per-project failures', result.failures)
  }

  return NextResponse.json({
    purged: result.purged.length,
    failed: result.failures.length,
    mayHaveMore: result.mayHaveMore,
  })
}
