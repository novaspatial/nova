import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, RESEND_FROM } from '@/lib/resend'

type NotifiableStatus = 'in_review' | 'processing' | 'mixing' | 'review'

function buildEmail(
  status: NotifiableStatus,
  projectTitle: string,
  projectUrl: string,
): { subject: string; text: string } | null {
  switch (status) {
    case 'in_review':
      return {
        subject: `We've received your files for "${projectTitle}"`,
        text: `Thanks for uploading your stems. Your project "${projectTitle}" is queued for review and we'll start mixing shortly.\n\nTrack progress: ${projectUrl}`,
      }
    case 'processing':
    case 'mixing':
      return {
        subject: `Mixing has started on "${projectTitle}"`,
        text: `Good news — we've started mixing "${projectTitle}". We'll let you know as soon as a preview is ready.\n\nProject: ${projectUrl}`,
      }
    case 'review':
      return {
        subject: `Your mix is ready to listen: "${projectTitle}"`,
        text: `Your mix for "${projectTitle}" is ready. Give it a listen and leave timestamped comments if you'd like any tweaks.\n\nListen: ${projectUrl}/listen`,
      }
    default:
      return null
  }
}

export async function sendProjectStatusEmail(
  supabase: SupabaseClient,
  projectId: string,
  status: string,
  origin: string,
): Promise<void> {
  const notifiable: NotifiableStatus[] = ['in_review', 'processing', 'mixing', 'review']
  if (!notifiable.includes(status as NotifiableStatus)) {
    return
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('title, owner:profiles!projects_owner_id_fkey(email, display_name)')
    .eq('id', projectId)
    .single<{
      title: string
      owner: { email: string | null; display_name: string | null } | null
    }>()

  if (error || !project?.owner?.email) {
    console.error('[email] Failed to load project/owner for notification:', error)
    return
  }

  const email = buildEmail(
    status as NotifiableStatus,
    project.title,
    `${origin}/portal/${projectId}`,
  )
  if (!email) return

  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM,
    to: project.owner.email,
    subject: email.subject,
    text: email.text,
  })

  if (sendError) {
    console.error('[email] Resend error:', sendError)
  }
}
