import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/supabaseServer'

export async function POST(request: Request) {
  const body = await request.json()
  const { name, email, subject, message } = body

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable.' },
      { status: 503 },
    )
  }

  const { error } = await supabase
    .from('contact_inquiries')
    .insert({ name, email, subject, message })

  if (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to submit inquiry.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
