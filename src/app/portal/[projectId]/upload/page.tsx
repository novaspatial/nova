import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import { FadeIn } from '@/components/FadeIn'
import { UploadManager } from './UploadManager'
import type { ProjectFile, ProjectStatus } from '@/types/portal'

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

  const isReadOnly = (project.status as ProjectStatus) !== 'uploading'

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Secure Upload
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload your multitrack stems and stereo master reference.
          </p>
        </div>

        <UploadManager
          projectId={projectId}
          existingFiles={(files as ProjectFile[]) || []}
          isReadOnly={isReadOnly}
        />
      </div>
    </FadeIn>
  )
}
