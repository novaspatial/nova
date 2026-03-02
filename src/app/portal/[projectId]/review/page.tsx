import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import { FadeIn } from '@/components/ui/FadeIn'
import { ReviewTimeline } from '@/components/portal/ReviewTimeline'
import type { ProjectComment } from '@/types/portal'

export default async function ReviewPage({
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
          projectId={projectId}
          initialComments={(comments as ProjectComment[]) || []}
          userId={user.id}
        />
      </div>
    </FadeIn>
  )
}
