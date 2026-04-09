import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { ReviewTimeline } from '@/components/portal/ReviewTimeline'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { ListenPlayer } from './ListenPlayer'
import type { ProjectComment } from '@/types/portal'

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
    format: 'atmos' | 'binaural' | 'both'
    status: string
  }>(supabase, projectId, 'id, title, format, status', profile?.role)

  const [{ data: files }, { data: comments }] = await Promise.all([
    supabase
      .from('project_files')
      .select('id, file_name, mime_type, storage_path')
      .eq('project_id', projectId)
      .eq('file_type', 'mix')
      .eq('upload_status', 'uploaded')
      .order('created_at', { ascending: true }),
    supabase
      .from('project_comments')
      .select(
        `
      *,
      author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)
    `,
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ])

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
      <div className="space-y-8">
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

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Timestamped Revisions
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Drop precise mix notes directly on the track timeline.
            </p>
          </div>

          <ReviewTimeline
            key={(comments as ProjectComment[])?.map((comment) => comment.id).join('|') || 'empty'}
            projectId={projectId}
            initialComments={(comments as ProjectComment[]) || []}
          />
        </div>
      </div>
    </FadeIn>
  )
}
