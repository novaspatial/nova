import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import { FadeIn } from '@/components/ui/FadeIn'
import { UploadManager } from '@/components/portal/UploadManager'
import type { ProjectFile, ProjectStatus, UserRole } from '@/types/portal'

export default async function UploadPage({
  params,
}: {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role as UserRole) || 'client'

  const { data: project } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', projectId)
    .single()

  if (!project) {
    notFound()
  }

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
            {isStudio ? 'Project Files' : 'Secure Upload'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isStudio
              ? 'View client uploads and upload your spatial mixes.'
              : 'Upload your multitrack stems and stereo master reference.'}
          </p>
        </div>

        <UploadManager
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
