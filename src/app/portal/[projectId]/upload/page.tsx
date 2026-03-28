import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { UploadManager } from '@/components/portal/UploadManager'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
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
  }>(supabase, projectId, 'id, status', role)

  const { data: files } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const status = project.status as ProjectStatus
  const isClientReadOnly = status !== 'uploading'
  const isStudio = role === 'studio'
  const studioCanUploadMix = isStudio && ['processing', 'mixing', 'review', 'revision'].includes(status)
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

        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            {isStudio
              ? 'Project Files'
              : isClientReadOnly
                ? "We're on it"
                : 'Secure Upload'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isStudio
              ? 'View client uploads and upload your spatial mixes.'
              : isClientReadOnly
                ? "Our engineers have started working on your project. We'll let you know as soon as there's an update."
                : 'Upload your multitrack stems and stereo master reference.'}
          </p>
        </div>

        <UploadManager
          key={`${status}-${files?.length ?? 0}`}
          projectId={projectId}
          existingFiles={(files as ProjectFile[]) || []}
          isReadOnly={isClientReadOnly}
          isStudio={isStudio}
          studioCanUploadMix={studioCanUploadMix}
          projectStatus={status}
        />
      </div>
    </FadeIn>
  )
}
