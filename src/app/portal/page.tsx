import { FadeIn } from '@/components/ui/FadeIn'
import { Button } from '@/components/ui/Button'
import { ProjectList, UploadPrep } from '@/components/portal'
import { requirePageProfile } from '@/lib/auth/server'
import type { Project } from '@/types/portal'

export default async function PortalDashboard() {
  const { supabase, user, profile } = await requirePageProfile()

  const isStudio = profile?.role === 'studio'

  const { data: projects } = await (isStudio
    ? supabase
        .from('projects')
        .select('*, owner:profiles!projects_owner_id_fkey(display_name, email)')
        .is('studio_deleted_at', null)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
    : supabase
        .from('projects')
        .select('*')
        .eq('owner_id', user.id)
        .is('client_deleted_at', null)
        .order('created_at', { ascending: false }))

  const hasProjects = Boolean(projects && projects.length > 0)

  return (
    <div className="mx-auto max-w-4xl">
      {hasProjects ? (
        <div className="space-y-8">
          {/* Clients can commission more than once — surface a New Project
              entry point (and the stem-prep guide) even when the list is
              non-empty. The studio doesn't create projects, so it's opted out. */}
          {!isStudio && (
            <FadeIn>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl font-semibold text-white sm:text-2xl">
                    Your Projects
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    Track a mix in progress or start a new one.
                  </p>
                </div>
                <Button href="/portal/new">New Project</Button>
              </div>
            </FadeIn>
          )}
          {!isStudio && (
            <FadeIn>
              <UploadPrep collapsible />
            </FadeIn>
          )}
          <ProjectList
            projects={projects as Project[]}
            isStudio={isStudio}
            userId={user.id}
          />
        </div>
      ) : isStudio ? (
        <FadeIn>
          <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center shadow-2xl shadow-violet-500/5 backdrop-blur-sm sm:p-12">
            <p className="text-base text-zinc-400">No projects yet.</p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn>
          <UploadPrep
            footer={
              <div className="text-center">
                <Button href="/portal/new">Start Your First Project</Button>
              </div>
            }
          />
        </FadeIn>
      )}
    </div>
  )
}
