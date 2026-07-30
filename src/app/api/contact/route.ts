import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/supabaseService'
import { resend, RESEND_FROM } from '@/lib/resend'
import { validateContactInput } from '@/lib/contact/validation'
import { hashClientIp, isContactRateLimited } from '@/lib/contact/rateLimit'

export async function POST(request: Request) {
  // The endpoint is public, so every input is hostile until proven
  // otherwise (#51) — a malformed body used to 500 here.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { input, error: validationError } = validateContactInput(body)
  if (!input) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // An inquiry is a system write: the row records where the request came
  // from, so an anonymous session must not author it directly (the public
  // INSERT policy is gone since 20260730).
  let supabase
  try {
    supabase = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const ipHash = hashClientIp(request)
  const rate = await isContactRateLimited(supabase, {
    email: input.email,
    ipHash,
  })
  if (rate.error) {
    console.error('Contact rate-limit check failed:', rate.error)
    return NextResponse.json(
      { error: 'Failed to submit inquiry.' },
      { status: 500 },
    )
  }
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429 },
    )
  }

  const { error } = await supabase
    .from('contact_inquiries')
    .insert({ ...input, ip_hash: ipHash })

  if (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to submit inquiry.' },
      { status: 500 },
    )
  }

  const recipient =
    process.env.CONTACT_INBOX_TO ||
    (process.env.NODE_ENV !== 'production' ? RESEND_FROM : null)

  if (!recipient) {
    console.warn(
      'Contact inquiry stored but not emailed: CONTACT_INBOX_TO is unset in production',
    )
  } else {
    // The Subject line is ours; the submitter's subject rides in the body,
    // where it cannot forge a header or impersonate a system notice.
    const { error: emailError } = await resend.emails.send({
      from: RESEND_FROM,
      to: recipient,
      subject: `New inquiry from ${input.name}`,
      replyTo: input.email,
      text: `Name: ${input.name}\nEmail: ${input.email}\nSubject: ${input.subject || 'N/A'}\n\n${input.message}`,
    })

    if (emailError) {
      console.error('Resend email error:', emailError)
    }
  }

  return NextResponse.json({ success: true })
}
