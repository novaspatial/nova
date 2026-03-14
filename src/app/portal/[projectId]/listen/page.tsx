import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { ListenPlayer } from './ListenPlayer'

export default async function ListenPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  noStore()
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  const project = await getProjectOrNotFound<{
    id: string
    title: string
    format: string
  }>(supabase, projectId, 'id, title, format', profile?.role)

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
          key={audioFiles.map((file) => `${file.id}:${file.signedUrl ?? 'missing'}`).join('|')}
          projectId={project.id}
          format={project.format}
          audioFiles={audioFiles}
        />
      </div>
    </FadeIn>
  )
}
