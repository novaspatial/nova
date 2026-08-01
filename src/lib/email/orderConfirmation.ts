import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, RESEND_FROM } from '@/lib/resend'
import { renderEmailHtml, type EmailRow } from '@/lib/email/layout'
import { absoluteUrl } from '@/lib/site'
import { formatCurrency } from '@/lib/formatCurrency'
import { ADD_ON_LABELS, CA_TAX_RATES } from '@/lib/stripe/pricing'
import type { AddOn, BuyerCountry, CAProvince } from '@/types/portal'

type ReceiptRow = {
  title: string
  amount_cents: number | null
  currency: string | null
  song_count: number | null
  subtotal_cents: number | null
  tax_cents: number | null
  buyer_country: BuyerCountry | null
  buyer_province: CAProvince | null
  applied_coupon_code: string | null
  add_ons: AddOn[] | null
  owner: { email: string | null } | null
}

// Renders from the frozen order row only — never recomputed through
// computeOrderPrice, so a later price change can't rewrite an old receipt.
function buildReceiptText(projectId: string, row: ReceiptRow): string {
  const currency = row.currency ?? 'usd'
  const lines: string[] = [
    "Thanks for your order — payment received. Here's your receipt.",
    '',
    `Order: "${row.title}"`,
  ]

  if (row.song_count) {
    lines.push(
      `${row.song_count} ${row.song_count === 1 ? 'song' : 'songs'} — Dolby Atmos mix`,
    )
  }
  if (row.add_ons?.length) {
    lines.push(
      `Add-ons: ${row.add_ons.map((addOn) => ADD_ON_LABELS[addOn] ?? addOn).join(', ')}`,
    )
  }
  if (row.applied_coupon_code) {
    lines.push(`Discount code ${row.applied_coupon_code} applied`)
  }

  lines.push('')
  if (row.subtotal_cents !== null) {
    lines.push(`Subtotal: ${formatCurrency(row.subtotal_cents, currency)}`)
  }
  if (row.tax_cents) {
    // Same label shape the quote showed at checkout ("HST (13%)"); the
    // GST fallback mirrors computeOrderPrice's CA-without-province default.
    const rate =
      row.buyer_country === 'CA'
        ? (row.buyer_province && CA_TAX_RATES[row.buyer_province]) ||
          ({ pct: 5, kind: 'gst' } as const)
        : null
    const taxLabel = rate ? `${rate.kind.toUpperCase()} (${rate.pct}%)` : 'Tax'
    lines.push(`${taxLabel}: ${formatCurrency(row.tax_cents, currency)}`)
  }
  if (row.amount_cents !== null) {
    lines.push(
      `Total: ${formatCurrency(row.amount_cents, currency)} ${currency.toUpperCase()}`,
    )
  }

  lines.push(
    '',
    'Upload your stems and track progress:',
    absoluteUrl(`/portal/${projectId}`),
    '',
    "We'll confirm an estimated delivery date once your files are received.",
    '',
    `Terms & Conditions: ${absoluteUrl('/terms')}`,
  )

  return lines.join('\n')
}

/**
 * The same receipt as HTML. Reads the identical frozen columns as
 * buildReceiptText — the two must always agree, so any change to what a
 * receipt states belongs in both.
 */
function buildReceiptHtml(projectId: string, row: ReceiptRow): string {
  const currency = row.currency ?? 'usd'
  const detail: string[] = []

  if (row.song_count) {
    detail.push(
      `${row.song_count} ${row.song_count === 1 ? 'song' : 'songs'} — Dolby Atmos mix`,
    )
  }
  if (row.add_ons?.length) {
    detail.push(
      `Add-ons: ${row.add_ons.map((addOn) => ADD_ON_LABELS[addOn] ?? addOn).join(', ')}`,
    )
  }
  if (row.applied_coupon_code) {
    detail.push(`Discount code ${row.applied_coupon_code} applied`)
  }

  const rows: EmailRow[] = []
  if (row.subtotal_cents !== null) {
    rows.push({
      label: 'Subtotal',
      value: formatCurrency(row.subtotal_cents, currency),
    })
  }
  if (row.tax_cents) {
    const rate =
      row.buyer_country === 'CA'
        ? (row.buyer_province && CA_TAX_RATES[row.buyer_province]) ||
          ({ pct: 5, kind: 'gst' } as const)
        : null
    const taxLabel = rate ? `${rate.kind.toUpperCase()} (${rate.pct}%)` : 'Tax'
    rows.push({
      label: taxLabel,
      value: formatCurrency(row.tax_cents, currency),
    })
  }
  if (row.amount_cents !== null) {
    rows.push({
      label: 'Total',
      value: `${formatCurrency(row.amount_cents, currency)} ${currency.toUpperCase()}`,
      strong: true,
    })
  }

  return renderEmailHtml({
    title: `Order confirmed — ${row.title}`,
    preheader: `Payment received for "${row.title}".`,
    heading: 'Order confirmed',
    body: [
      'Thanks for your order — payment received. Here’s your receipt.',
      [`Order: "${row.title}"`, ...detail].join(' · '),
    ],
    rows,
    cta: {
      label: 'Upload your stems',
      href: absoluteUrl(`/portal/${projectId}`),
    },
    footnote: `We'll confirm an estimated delivery date once your files are received. Terms & Conditions: ${absoluteUrl('/terms')}`,
  })
}

/**
 * Order-confirmation receipt (#24), sent when a payment writer makes the
 * project paid: the webhook or the poll route after WINNING the
 * claimProjectPayment CAS (the fence makes the winner unique, so the losers
 * and Stripe replays never double-send), or the dev-bypass born-paid insert.
 *
 * Best-effort by contract: never throws, so no caller can fail a payment
 * acknowledgement over email. Errors log ids only — never money amounts.
 * Links come from the siteConfig origin (the webhook has no request origin).
 */
export async function sendOrderConfirmationEmail(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        'title, amount_cents, currency, song_count, subtotal_cents, tax_cents, buyer_country, buyer_province, applied_coupon_code, add_ons, owner:profiles!projects_owner_id_fkey(email)',
      )
      .eq('id', projectId)
      .single<ReceiptRow>()

    if (error || !project?.owner?.email) {
      console.error('[email] Failed to load order for confirmation:', {
        project: projectId,
        error,
      })
      return
    }

    const { error: sendError } = await resend.emails.send({
      from: RESEND_FROM,
      to: project.owner.email,
      subject: `Order confirmed — "${project.title}"`,
      text: buildReceiptText(projectId, project),
      html: buildReceiptHtml(projectId, project),
    })

    if (sendError) {
      console.error('[email] Resend error:', sendError)
    }
  } catch (err) {
    console.error('[email] Order confirmation failed:', {
      project: projectId,
      err,
    })
  }
}
