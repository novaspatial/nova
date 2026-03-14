import { redirect } from 'next/navigation'
import {
  getProjectOrNotFound,
  requirePageUser,
} from '@/lib/auth/server'
import type { ProjectStatus } from '@/types/portal'

const statusToStep: Record<ProjectStatus, string> = {
  uploading: 'upload',
  processing: 'upload',
  mixing: 'upload',
  review: 'review',
  revision: 'review',
  approved: 'deliver',
  delivered: 'deliver',
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { supabase } = await requirePageUser()
  const project = await getProjectOrNotFound<{ status: ProjectStatus }>(
    supabase,
    projectId,
    'status',
  )

  const step = statusToStep[project.status as ProjectStatus] || 'upload'
  redirect(`/portal/${projectId}/${step}`)
}
