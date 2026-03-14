import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
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
  noStore()
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()

  const isStudio = profile?.role === 'studio'

  const project = await getProjectOrNotFound<{
    id: string
    title: string
    status: ProjectStatus
  }>(supabase, projectId, 'id, title, status', profile?.role)

  return (
    <div className="mx-auto max-w-4xl">
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {project.title}
          </h1>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-white/5 px-4 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:text-white hover:ring-white/20 hover:shadow-md hover:shadow-violet-500/20 hover:scale-105"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="size-4"
            >
              <path
                fillRule="evenodd"
                d="M17.5 10a.75.75 0 0 1-.75.75H5.06l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 1 1 1.06 1.06L5.06 9.25h11.69a.75.75 0 0 1 .75.75Z"
                clipRule="evenodd"
              />
            </svg>
            Back to Projects
          </Link>
        </div>
        <div className="mt-4 sm:mt-6">
          <StepNavigation
            key={`${isStudio ? 'studio' : 'client'}-${project.status}`}
            projectId={project.id}
            status={project.status as ProjectStatus}
            isStudio={isStudio}
          />
        </div>
      </FadeIn>
      <div key={project.status} className="mt-6 sm:mt-8">
        {children}
      </div>
    </div>
  )
}
