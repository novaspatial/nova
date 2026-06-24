import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { FadeIn } from '@/components/ui/FadeIn'
import { ProjectList } from '@/components/portal'
import { requirePageProfile } from '@/lib/auth/server'
import type { Project } from '@/types/portal'

export const metadata = {
  title: 'Archived Projects',
}

export default async function ArchivedProjectsPage() {
  const { supabase, user, profile } = await requirePageProfile()

  // Archiving is a studio-only organisational tool.
  if (profile?.role !== 'studio') {
    redirect('/portal')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*, owner:profiles!projects_owner_id_fkey(display_name, email)')
    .is('studio_deleted_at', null)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  return (
    <div className="mx-auto max-w-4xl">
      <FadeIn>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          <ArrowLeftIcon className="size-4" />
          Back to projects
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Archived Projects
          </h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            Projects you&rsquo;ve archived. Restore one to bring it back to the
            main dashboard.
          </p>
        </div>
      </FadeIn>

      <div className="mt-8 sm:mt-10">
        {projects && projects.length > 0 ? (
          <ProjectList
            projects={projects as Project[]}
            isStudio
            userId={user.id}
            archivedView
          />
        ) : (
          <FadeIn>
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center shadow-2xl shadow-violet-500/5 backdrop-blur-sm sm:p-12">
              <p className="text-base text-zinc-400">No archived projects yet.</p>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  )
}
