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
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  const project = await getProjectOrNotFound<{
    id: string
    status: ProjectStatus
  }>(supabase, projectId, 'id, status')

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
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Platform-Ready Delivery
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Download your approved ADM BWF master files for Apple Music, Tidal,
            Amazon Music, and all immersive platforms.
          </p>
        </div>

        <DeliverableList
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
