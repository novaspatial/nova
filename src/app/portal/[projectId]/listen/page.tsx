import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { ReviewTimeline } from '@/components/portal'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { ListenPlayer } from './ListenPlayer'
import type { ProjectComment, ProjectCommentAttachment } from '@/types/portal'

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

  const [{ data: files }, { data: comments }, { data: attachmentRows }] =
    await Promise.all([
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
          '*, author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)',
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('project_comment_attachments')
        .select(
          'id, comment_id, project_id, file_name, file_size, mime_type, storage_path, created_at',
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
    ])

  const attachmentsByComment = new Map<string, ProjectCommentAttachment[]>()
  for (const row of (attachmentRows as ProjectCommentAttachment[]) ?? []) {
    const list = attachmentsByComment.get(row.comment_id) ?? []
    list.push(row)
    attachmentsByComment.set(row.comment_id, list)
  }

  const audioFiles = await Promise.all(
    (files || []).map(async (file) => {
      const { data: urlData } = await supabase.storage
        .from('project-uploads')
        .createSignedUrl(file.storage_path, 3600)
      return { ...file, signedUrl: urlData?.signedUrl ?? null }
    }),
  )

  const commentsWithAttachments = await Promise.all(
    ((comments as ProjectComment[]) ?? []).map(async (comment) => {
      const rawAttachments = attachmentsByComment.get(comment.id) ?? []
      if (rawAttachments.length === 0) return { ...comment, attachments: [] }
      const signed = await Promise.all(
        rawAttachments.map(async (attachment) => {
          const [viewResult, downloadResult] = await Promise.all([
            supabase.storage
              .from('project-uploads')
              .createSignedUrl(attachment.storage_path, 3600),
            supabase.storage
              .from('project-uploads')
              .createSignedUrl(attachment.storage_path, 3600, {
                download: attachment.file_name,
              }),
          ])
          return {
            ...attachment,
            view_url: viewResult.data?.signedUrl ?? null,
            download_url: downloadResult.data?.signedUrl ?? null,
          }
        }),
      )
      return { ...comment, attachments: signed }
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

        <ReviewTimeline
          key={commentsWithAttachments.map((comment) => comment.id).join('|') || 'empty'}
          projectId={projectId}
          initialComments={commentsWithAttachments}
        />
      </div>
    </FadeIn>
  )
}
