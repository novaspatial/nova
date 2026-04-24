import { Resend } from 'resend'

// The dummy key keeps this module importable at build time (the `Resend`
// constructor validates the key format). If `RESEND_API_KEY` is unset in
// production, sends will fail at runtime — they are not fatal, so callers
// log and continue rather than throwing. Validate the env var at deploy.
export const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build')

export const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Atmos <onboarding@resend.dev>'
