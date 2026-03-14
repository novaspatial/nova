import { StepNavigation } from '@/components/portal/StepNavigation'
import { FadeIn } from '@/components/ui/FadeIn'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import type { ProjectStatus } from '@/types/portal'

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()

  const isStudio = profile?.role === 'studio'

  const project = await getProjectOrNotFound<{
    id: string
    title: string
    status: ProjectStatus
  }>(supabase, projectId, 'id, title, status')

  return (
    <div className="mx-auto max-w-4xl">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {project.title}
        </h1>
        <div className="mt-4 sm:mt-6">
          <StepNavigation
            projectId={project.id}
            status={project.status as ProjectStatus}
            isStudio={isStudio}
          />
        </div>
      </FadeIn>
      <div className="mt-6 sm:mt-8">{children}</div>
    </div>
  )
}
