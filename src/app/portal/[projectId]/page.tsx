import { redirect } from 'next/navigation'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import type { ProjectStatus } from '@/types/portal'

const statusToStep: Record<ProjectStatus, string> = {
  uploading: 'upload',
  in_review: 'upload',
  processing: 'upload',
  mixing: 'upload',
  review: 'comments',
  revision: 'comments',
  approved: 'deliver',
  delivered: 'deliver',
}

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

  const step = statusToStep[project.status as ProjectStatus] || 'upload'
  redirect(`/portal/${projectId}/${step}`)
}
