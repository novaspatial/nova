import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, RESEND_FROM } from '@/lib/resend'
import {
  isNotifiableStatus,
  type NotifiableStatus,
} from '@/lib/portal/workflow'

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
    case 'delivered':
      return {
        subject: `"${projectTitle}" has been delivered`,
        text: `Your final mix for "${projectTitle}" has been delivered. Thanks for mixing with us — we hope you love how it turned out.\n\nProject: ${projectUrl}`,
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
  if (!isNotifiableStatus(status)) {
    return
  }

  // Best-effort, like every other send in this directory: the caller's
  // write has already committed by the time we get here, so a throwing
  // lookup or Resend outage must never turn a successful status change
  // into a 500 (#49).
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        'title, owner:profiles!projects_owner_id_fkey(email, display_name)',
      )
      .eq('id', projectId)
      .single<{
        title: string
        owner: { email: string | null; display_name: string | null } | null
      }>()

    if (error || !project?.owner?.email) {
      console.error(
        '[email] Failed to load project/owner for notification:',
        error,
      )
      return
    }

    const email = buildEmail(
      status,
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
  } catch (err) {
    console.error('[email] Status notification failed:', {
      projectId,
      status,
      error: err,
    })
  }
}
