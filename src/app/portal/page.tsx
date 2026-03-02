import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect } from 'next/navigation'
import { FadeIn, FadeInStagger } from '@/components/ui/FadeIn'
import { Button } from '@/components/ui/Button'
import { ProjectCard } from '@/components/portal/ProjectCard'
import type { Project } from '@/types/portal'

export default async function PortalDashboard() {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isStudio = profile?.role === 'studio'

  const { data: projects } = await (isStudio
    ? supabase
        .from('projects')
        .select('*, owner:profiles!projects_owner_id_fkey(display_name, email)')
        .order('created_at', { ascending: false })
    : supabase
        .from('projects')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }))

  return (
    <div className="mx-auto max-w-4xl">
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {isStudio ? 'All Projects' : 'Your Projects'}
            </h1>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base">
              {isStudio
                ? 'Manage all client mixing projects.'
                : 'Track your Dolby Atmos mixing projects.'}
            </p>
          </div>
          {!isStudio && (
            <Button href="/portal/new" className="shrink-0">
              New Project
            </Button>
          )}
        </div>
      </FadeIn>

      <div className="mt-8 sm:mt-10">
        {projects && projects.length > 0 ? (
          <FadeInStagger faster>
            <div className="grid gap-4 sm:grid-cols-2">
              {(projects as Project[]).map((project) => (
                <FadeIn key={project.id}>
                  <ProjectCard project={project} />
                </FadeIn>
              ))}
            </div>
          </FadeInStagger>
        ) : (
          <FadeIn>
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center shadow-2xl shadow-violet-500/5 backdrop-blur-sm sm:p-12">
              <p className="text-base text-zinc-400">
                No projects yet.
              </p>
              {!isStudio && (
                <div className="mt-6">
                  <Button href="/portal/new">
                    Start Your First Project
                  </Button>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  )
}
