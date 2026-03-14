import { unstable_noStore as noStore } from 'next/cache'
import { FadeIn } from '@/components/ui/FadeIn'
import { ReviewTimeline } from '@/components/portal/ReviewTimeline'
import {
  getProjectOrNotFound,
  requirePageProfile,
} from '@/lib/auth/server'
import type { ProjectComment } from '@/types/portal'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  noStore()
  const { projectId } = await params
  const { supabase, profile } = await requirePageProfile()
  await getProjectOrNotFound<{ id: string; status: string }>(
    supabase,
    projectId,
    'id, status',
    profile?.role,
  )

  const { data: comments } = await supabase
    .from('project_comments')
    .select(
      `
      *,
      author:profiles!project_comments_author_id_fkey(display_name, avatar_url, role)
    `,
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  return (
    <FadeIn>
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
    </FadeIn>
  )
}
