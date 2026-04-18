import { redirect } from 'next/navigation'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  await getProjectOrNotFound<{ id: string }>(
    supabase,
    projectId,
    'id',
    profile?.role,
  )

  redirect(`/portal/${projectId}/upload`)
}
