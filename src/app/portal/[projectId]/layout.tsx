import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import { StepNavigation } from '@/components/portal/StepNavigation'
import { FadeIn } from '@/components/FadeIn'
import type { ProjectStatus } from '@/types/portal'

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()

  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, status')
    .eq('id', projectId)
    .single()

  if (!project) {
    notFound()
  }

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
          />
        </div>
      </FadeIn>
      <div className="mt-6 sm:mt-8">{children}</div>
    </div>
  )
}
