import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build')

export const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Atmos <onboarding@resend.dev>'
