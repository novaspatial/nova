import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
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
  const supabase = await createClient()

  if (!supabase) {
    redirect('/login')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('status')
    .eq('id', projectId)
    .single()

  if (!project) {
    notFound()
  }

  const step = statusToStep[project.status as ProjectStatus] || 'upload'
  redirect(`/portal/${projectId}/${step}`)
}
