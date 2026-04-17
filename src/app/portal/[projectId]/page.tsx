import { redirect } from 'next/navigation'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import type { ProjectStatus } from '@/types/portal'
import { getStepForStatus } from '@/lib/portal/workflow'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  const project = await getProjectOrNotFound<{ status: ProjectStatus }>(
    supabase,
    projectId,
    'status',
    profile?.role,
  )

  const step = getStepForStatus(project.status as ProjectStatus)
  redirect(`/portal/${projectId}/${step}`)
}
