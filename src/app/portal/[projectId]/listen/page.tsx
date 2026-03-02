import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import { FadeIn } from '@/components/FadeIn'
import { ListenPlayer } from './ListenPlayer'

export default async function ListenPage({
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
    .select('id, title, format')
    .eq('id', projectId)
    .single()

  if (!project) {
    notFound()
  }

  const { data: files } = await supabase
    .from('project_files')
    .select('id, file_name, mime_type, storage_path')
    .eq('project_id', projectId)
    .eq('file_type', 'mix')
    .eq('upload_status', 'uploaded')
    .order('created_at', { ascending: true })

  const audioFiles = await Promise.all(
    (files || []).map(async (file) => {
      const { data: urlData } = await supabase.storage
        .from('project-uploads')
        .createSignedUrl(file.storage_path, 3600)
      return { ...file, signedUrl: urlData?.signedUrl ?? null }
    }),
  )

  return (
    <FadeIn>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Interactive Listening
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Experience your spatial mix with high-fidelity Binaural and Dolby
            Atmos playback.
          </p>
        </div>

        <ListenPlayer
          projectId={project.id}
          format={project.format}
          audioFiles={audioFiles}
        />
      </div>
    </FadeIn>
  )
}
