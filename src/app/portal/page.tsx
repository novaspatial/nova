import Link from 'next/link'
import { ArchiveBoxIcon } from '@heroicons/react/24/outline'
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

  let archivedCount = 0
  if (isStudio) {
    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .is('studio_deleted_at', null)
      .not('archived_at', 'is', null)
    archivedCount = count ?? 0
  }

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
          {isStudio ? (
            <Link
              href="/portal/archived"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <ArchiveBoxIcon className="size-4" />
              Archived
              {archivedCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-zinc-200">
                  {archivedCount}
                </span>
              )}
            </Link>
          ) : (
            <Button href="/portal/new" className="shrink-0">
              New Project
            </Button>
          )}
        </div>
      </FadeIn>

      <div className="mt-8 sm:mt-10">
        {projects && projects.length > 0 ? (
          <ProjectList
            projects={projects as Project[]}
            isStudio={isStudio}
            userId={user.id}
          />
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
                  <p className="text-base text-zinc-400">No projects yet.</p>
                  <div className="mt-6">
                    <Button href="/portal/new">Start Your First Project</Button>
                  </div>
                </div>
              }
            />
          </FadeIn>
        )}
      </div>
    </div>
  )
}
