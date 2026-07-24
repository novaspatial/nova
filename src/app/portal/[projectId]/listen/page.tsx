import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import { signedUrlFor } from '@/lib/portal/storage'
import { ListenView } from './ListenView'
import type {
  ProjectComment,
  ProjectCommentAttachment,
} from '@/types/portal'

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
  }>(supabase, projectId, 'id, title, format', profile?.role)

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
      const [streamResult, downloadResult] = await Promise.all([
        signedUrlFor(supabase, 'mix', file.storage_path),
        signedUrlFor(supabase, 'mix', file.storage_path, {
          downloadName: file.file_name,
        }),
      ])

      return {
        ...file,
        signedUrl: 'url' in streamResult ? streamResult.url : null,
        downloadUrl: 'url' in downloadResult ? downloadResult.url : null,
      }
    }),
  )

  const commentsWithAttachments = await Promise.all(
    ((comments as ProjectComment[]) ?? []).map(async (comment) => {
      const rawAttachments = attachmentsByComment.get(comment.id) ?? []
      if (rawAttachments.length === 0) return { ...comment, attachments: [] }
      const signed = await Promise.all(
        rawAttachments.map(async (attachment) => {
          const [viewResult, downloadResult] = await Promise.all([
            signedUrlFor(supabase, 'comment_attachment', attachment.storage_path),
            signedUrlFor(supabase, 'comment_attachment', attachment.storage_path, {
              downloadName: attachment.file_name,
            }),
          ])
          return {
            ...attachment,
            view_url: 'url' in viewResult ? viewResult.url : null,
            download_url: 'url' in downloadResult ? downloadResult.url : null,
          }
        }),
      )
      return { ...comment, attachments: signed }
    }),
  )

  return (
    <FadeIn>
      <ListenView
        key={audioFiles.map((file) => file.id).join('|')}
        projectId={project.id}
        format={project.format}
        audioFiles={audioFiles}
        initialComments={commentsWithAttachments}
        currentUserId={profile?.id ?? null}
        currentRole={profile?.role ?? null}
      />
    </FadeIn>
  )
}
