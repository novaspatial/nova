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

  return (
    <FadeIn>
      <div className="space-y-6">
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
