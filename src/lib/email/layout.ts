import { SITE_URL } from '@/lib/site'

// The one HTML shell every app-sent email renders through, so the receipt and
// the status notifications look like the signup/recovery mails the client
// already got. Those two live in the Supabase dashboard and can't import from
// here — the tokens below are transcribed from them, so if either side is
// restyled, move both together.
//
// Email clients are a hostile render target: no <style> blocks worth relying
// on, no flexbox, no external CSS. Hence tables, inline styles, and a
// table-wrapped anchor for the button (Outlook won't honour padding on an
// inline-block <a>).
//
// Every colour is stated explicitly, including the backgrounds. Declaring
// `color-scheme: dark` tells the client we handle dark mode ourselves, which
// suppresses its automatic inversion — so an unstated background would leave
// light-theme text on the client's dark canvas. That exact bug shipped in both
// auth templates (a #18181b headline on a dark background) and is why the
// backgrounds below are pinned on the body and on every table.
const PAGE_BG = '#09090b'
const CARD_BG = '#18181b'
const BORDER = '#3f3f46'
const ACCENT = '#8b5cf6'
const HEADING = '#fafafa'
const BODY = '#a1a1aa'
const MUTED = '#71717a'
const FONT =
  "'Mona Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/**
 * Escape a value for interpolation into the HTML body.
 *
 * Load-bearing, not decorative: project titles, contact-form fields and
 * discount codes are all user input. They were safe while these emails were
 * text/plain; the moment they land in markup, an unescaped `<` is HTML
 * injection into a message we send on the studio's behalf. Every interpolation
 * in this file and its callers goes through here.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type EmailCta = { label: string; href: string }

/** A label/value pair in the summary table (receipt line items). */
export type EmailRow = { label: string; value: string; strong?: boolean }

export type EmailContent = {
  /** Document <title>. */
  title: string
  /** Hidden preview text — what inboxes show next to the subject. */
  preheader: string
  heading: string
  /** Body paragraphs, in order. */
  body: string[]
  cta?: EmailCta
  rows?: EmailRow[]
  /** Small print under the divider. */
  footnote?: string
}

function renderRows(rows: EmailRow[]): string {
  const cells = rows
    .map(({ label, value, strong }) => {
      const color = strong ? HEADING : BODY
      const weight = strong ? '600' : '400'
      const size = strong ? '16px' : '14px'
      return `<tr>
                    <td align="left" style="padding:6px 0;font-family:${FONT};font-size:${size};font-weight:${weight};color:${color};">${escapeHtml(label)}</td>
                    <td align="right" style="padding:6px 0;font-family:${FONT};font-size:${size};font-weight:${weight};color:${color};">${escapeHtml(value)}</td>
                  </tr>`
    })
    .join('\n')

  return `
            <tr>
              <td style="padding:0 48px 32px 48px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cells}
                </table>
              </td>
            </tr>`
}

function renderCta({ label, href }: EmailCta): string {
  return `
            <tr>
              <td align="center" style="padding:0 48px 32px 48px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td align="center" bgcolor="${ACCENT}" style="border-radius:10px;background-color:${ACCENT};">
                      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;border:1px solid ${ACCENT};letter-spacing:0.01em;">${escapeHtml(label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
}

/** Render one email to a complete HTML document. Pure — no I/O, no env reads. */
export function renderEmailHtml(content: EmailContent): string {
  const { title, preheader, heading, body, cta, rows, footnote } = content

  const paragraphs = body
    .map(
      (text) => `
            <tr>
              <td align="center" style="padding:0 48px 24px 48px;">
                <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.65;color:${BODY};text-align:center;">${escapeHtml(text)}</p>
              </td>
            </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD_BG}" style="width:100%;max-width:600px;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">

            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#1e1a5e 0%,#321466 33%,#3d1260 66%,#4e0e52 100%);background-color:#321466;line-height:4px;font-size:0;">&nbsp;</td>
            </tr>

            <tr>
              <td align="center" style="padding:40px 48px 24px 48px;">
                <span style="font-family:${FONT};font-size:34px;line-height:1;font-weight:700;color:${ACCENT};letter-spacing:-0.04em;">//</span>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 48px 16px 48px;">
                <h1 style="margin:0;font-family:${FONT};font-size:32px;line-height:1.2;font-weight:600;letter-spacing:-0.01em;color:${HEADING};text-align:center;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
${paragraphs}${rows?.length ? renderRows(rows) : ''}${cta ? renderCta(cta) : ''}
            <tr>
              <td style="padding:0 48px;">
                <div style="height:1px;background-color:${BORDER};line-height:1px;font-size:0;">&nbsp;</div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 48px 40px 48px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">${escapeHtml(footnote ?? 'If you weren’t expecting this email, you can safely ignore it.')}</p>
              </td>
            </tr>
          </table>

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td align="center" style="padding:24px 20px 0 20px;">
                <p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">NovaSpatial — World-class Dolby Atmos mixing</p>
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                  <a href="${SITE_URL}" style="color:${MUTED};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`
}
