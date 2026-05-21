import { redirect } from 'next/navigation'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { getStepForStatus } from '@/lib/portal/workflow'
import type { ProjectStatus } from '@/types/portal'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  const project = await getProjectOrNotFound<{ id: string; status: ProjectStatus }>(
    supabase,
    projectId,
    'id, status',
    profile?.role,
  )

  redirect(`/portal/${projectId}/${getStepForStatus(project.status)}`)
}
