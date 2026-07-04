import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { ProgressTimeline, UploadManager, UploadPrep } from '@/components/portal'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { canUploadStems } from '@/lib/portal/workflow'
import type { ProjectFile, ProjectStatus, UserRole } from '@/types/portal'

export default async function UploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  noStore()
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()

  const role = (profile?.role as UserRole) || 'client'

  const project = await getProjectOrNotFound<{
    id: string
    status: ProjectStatus
    notes: string | null
    reference_tracks: string | null
  }>(supabase, projectId, 'id, status, notes, reference_tracks', role)

  const { data: files } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const status = project.status as ProjectStatus
  const isClientReadOnly = !canUploadStems(status)
  const isStudio = role === 'studio'
  const isReview = !isStudio && status === 'review'

  return (
    <FadeIn>
      <div className="space-y-6">
        {isReview && (
          <a
            href={`/portal/${projectId}/listen`}
            className="flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-4 transition hover:bg-violet-500/15"
          >
            <span className="mt-0.5 text-violet-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-300">Your mix is ready for review</p>
              <p className="mt-0.5 text-xs text-zinc-400">Our engineers have uploaded a mix for you. Listen and leave feedback — tap here to go to the listening page.</p>
            </div>
          </a>
        )}

        {isStudio ? (
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Project Files
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              View client uploads and upload your spatial mixes.
            </p>
          </div>
        ) : isClientReadOnly && !isReview ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-5 backdrop-blur-sm">
            <span className="relative mt-0.5 inline-flex">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                We&apos;re on it
              </p>
              <p className="mt-1 text-sm text-emerald-300/60">
                Our engineers have started working on your project. We&apos;ll
                let you know as soon as there&apos;s an update.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Secure Upload
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Upload your multitrack stems and stereo master reference.
            </p>
          </div>
        )}

        {!isStudio && <ProgressTimeline status={status} />}

        {(project.notes || project.reference_tracks) && (
          <div className="rounded-2xl border border-white/10 bg-white/2 p-5 backdrop-blur-sm sm:p-6">
            <h3 className="text-sm font-semibold text-white">Project details</h3>
            {project.notes && (
              <div className="mt-3">
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Notes
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-300">
                  {project.notes}
                </p>
              </div>
            )}
            {project.reference_tracks && (
              <div className="mt-3">
                <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Reference tracks
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-300">
                  {project.reference_tracks}
                </p>
              </div>
            )}
          </div>
        )}

        {!isStudio && !isClientReadOnly && <UploadPrep collapsible />}

        <UploadManager
          key={`${status}-${files?.length ?? 0}`}
          existingFiles={(files as ProjectFile[]) || []}
          isReadOnly={isClientReadOnly}
        />
      </div>
    </FadeIn>
  )
}
