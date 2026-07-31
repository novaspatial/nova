import { NextResponse, type NextRequest } from 'next/server'

import { sweepOrphanedUploads } from '@/lib/portal/orphanSweep'
import { createServiceClient } from '@/lib/supabase/supabaseService'

// The orphan-sweep entrypoint, invoked by the Vercel Cron in vercel.json
// (#59). Same guard as the retention purge: Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`, and the route fails closed (500)
// without the secret so an undeployed env can never leave the sweep
// publicly triggerable.

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
      {
        error:
          err instanceof Error ? err.message : 'Service client unavailable',
      },
      { status: 500 },
    )
  }

  const result = await sweepOrphanedUploads(supabase)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  if (result.failures.length > 0) {
    console.error('[sweep-orphans] per-item failures', result.failures)
  }

  if (result.mayHaveMore) {
    console.warn('[sweep-orphans] batch filled — more orphans await sweep', {
      pendingRowsRemoved: result.pendingRowsRemoved,
      orphanObjectsRemoved: result.orphanObjectsRemoved,
    })
  }

  return NextResponse.json({
    pendingRowsRemoved: result.pendingRowsRemoved,
    orphanObjectsRemoved: result.orphanObjectsRemoved,
    failed: result.failures.length,
    mayHaveMore: result.mayHaveMore,
  })
}
