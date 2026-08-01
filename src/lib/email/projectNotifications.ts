import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, RESEND_FROM } from '@/lib/resend'
import { renderEmailHtml } from '@/lib/email/layout'
import { absoluteUrl } from '@/lib/site'
import {
  isNotifiableStatus,
  type NotifiableStatus,
} from '@/lib/portal/workflow'

type BuiltEmail = { subject: string; text: string; html: string }

// Both parts of every message are built from one description, so the plain
// text and the HTML can't drift apart. text/plain is kept deliberately: it is
// the multipart alternative for clients that refuse HTML, and it is the
// fallback that still works if anything about the markup goes wrong.
function build(
  subject: string,
  heading: string,
  bodyText: string,
  cta: { label: string; href: string },
  preheader: string,
): BuiltEmail {
  return {
    subject,
    text: `${bodyText}\n\n${cta.label}: ${cta.href}`,
    html: renderEmailHtml({
      title: subject,
      preheader,
      heading,
      body: [bodyText],
      cta,
      footnote:
        'You’re receiving this because you have a project with NOVA Spatial.',
    }),
  }
}

function buildEmail(
  status: NotifiableStatus,
  projectTitle: string,
  projectUrl: string,
): BuiltEmail | null {
  switch (status) {
    case 'in_review':
      return build(
        `We've received your files for "${projectTitle}"`,
        'Files received',
        `Thanks for uploading your stems. Your project "${projectTitle}" is queued for review and we'll start mixing shortly.`,
        { label: 'Track progress', href: projectUrl },
        'Your stems are in — mixing starts shortly.',
      )
    case 'processing':
    case 'mixing':
      return build(
        `Mixing has started on "${projectTitle}"`,
        'Mixing has started',
        `Good news — we've started mixing "${projectTitle}". We'll let you know as soon as a preview is ready.`,
        { label: 'View your project', href: projectUrl },
        'We’ve started mixing your project.',
      )
    case 'review':
      return build(
        `Your mix is ready to listen: "${projectTitle}"`,
        'Your mix is ready',
        `Your mix for "${projectTitle}" is ready. Give it a listen and leave timestamped comments if you'd like any tweaks.`,
        { label: 'Listen to your mix', href: `${projectUrl}/listen` },
        'Your mix is ready to listen.',
      )
    case 'delivered':
      return build(
        `"${projectTitle}" has been delivered`,
        'Your mix has been delivered',
        `Your final mix for "${projectTitle}" has been delivered. Thanks for mixing with us — we hope you love how it turned out.`,
        { label: 'View your project', href: projectUrl },
        'Your final mix has been delivered.',
      )
    default:
      return null
  }
}

/**
 * Links resolve against the canonical host, never the request's. A studio user
 * driving a transition from a preview deploy would otherwise mail the client a
 * preview URL — `SITE_URL` is the single source of truth for the host.
 */
export async function sendProjectStatusEmail(
  supabase: SupabaseClient,
  projectId: string,
  status: string,
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
      absoluteUrl(`/portal/${projectId}`),
    )
    if (!email) return

    const { error: sendError } = await resend.emails.send({
      from: RESEND_FROM,
      to: project.owner.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
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
