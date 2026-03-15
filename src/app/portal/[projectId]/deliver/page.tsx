import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { DeliverableList } from '@/components/portal/DeliverableList'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import type { Deliverable, ProjectStatus } from '@/types/portal'

export default async function DeliverPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  noStore()
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  const project = await getProjectOrNotFound<{
    id: string
    status: ProjectStatus
  }>(supabase, projectId, 'id, status', profile?.role)

  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const isStudio = profile?.role === 'studio'
  const isApproved =
    project.status === 'approved' || project.status === 'delivered'

  return (
    <FadeIn>
      <div className="space-y-6">
        <DeliverableList
          key={`${project.status}-${deliverables?.length ?? 0}`}
          projectId={projectId}
          deliverables={(deliverables as Deliverable[]) || []}
          isStudio={isStudio}
          isApproved={isApproved}
          projectStatus={project.status as ProjectStatus}
        />
      </div>
    </FadeIn>
  )
}
