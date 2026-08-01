import { escapeHtml, renderEmailHtml } from './layout'
import { SITE_URL } from '@/lib/site'

describe('escapeHtml', () => {
  test('neutralizes the characters that could open a tag or attribute', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
    expect(escapeHtml('a "b" \'c\'')).toBe('a &quot;b&quot; &#39;c&#39;')
  })

  test('escapes the ampersand first, so entities are not double-decoded', () => {
    // & last would turn the & of &lt; back into a literal on the next pass.
    expect(escapeHtml('Tom & <Jerry>')).toBe('Tom &amp; &lt;Jerry&gt;')
  })

  test('leaves ordinary text untouched', () => {
    expect(escapeHtml('Night Drive (Deluxe) — 4 songs')).toBe(
      'Night Drive (Deluxe) — 4 songs',
    )
  })
})

describe('renderEmailHtml', () => {
  const base = {
    title: 'Test',
    preheader: 'Preview line',
    heading: 'Heading',
    body: ['First paragraph.'],
  }

  test('renders a complete document with the dark-mode contract intact', () => {
    const html = renderEmailHtml(base)

    expect(html).toContain('<!DOCTYPE html>')
    // Declaring color-scheme suppresses the client's auto-inversion, so the
    // backgrounds must be stated or the light-on-dark bug returns.
    expect(html).toContain('<meta name="color-scheme" content="dark" />')
    expect(html).toContain('background-color:#09090b')
    expect(html).toContain('background-color:#18181b')
    expect(html).toContain('color:#fafafa')
  })

  test('puts the preheader in a hidden node, not the visible body', () => {
    const html = renderEmailHtml({ ...base, preheader: 'Sneak peek' })
    expect(html).toMatch(/display:none;[^"]*">Sneak peek</)
  })

  test('renders each body paragraph', () => {
    const html = renderEmailHtml({ ...base, body: ['One.', 'Two.'] })
    expect(html).toContain('One.')
    expect(html).toContain('Two.')
  })

  test('escapes every caller-supplied field', () => {
    const html = renderEmailHtml({
      title: '<title>',
      preheader: '<pre>',
      heading: 'Mix for "<b>Night</b>"',
      body: ['<img src=x onerror=alert(1)>'],
      footnote: '<hr>',
    })

    expect(html).toContain('Mix for &quot;&lt;b&gt;Night&lt;/b&gt;&quot;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toMatch(/<b>Night<\/b>/)
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<hr>')
  })

  test('renders the CTA as a table-wrapped anchor with an escaped href', () => {
    const html = renderEmailHtml({
      ...base,
      cta: { label: 'Listen', href: 'https://nova-spatial.com/p?a=1&b=2' },
    })

    expect(html).toContain('href="https://nova-spatial.com/p?a=1&amp;b=2"')
    expect(html).toContain('>Listen</a>')
    // Outlook ignores padding on a bare inline-block anchor.
    expect(html).toContain('bgcolor="#8b5cf6"')
  })

  test('omits the CTA and the rows table when not supplied', () => {
    const html = renderEmailHtml(base)
    // The footer's site link is always an <a>, so key off the button's chrome.
    expect(html).not.toContain('bgcolor="#8b5cf6"')
    expect(html).not.toContain('Subtotal')
  })

  test('renders summary rows, emphasising the ones marked strong', () => {
    const html = renderEmailHtml({
      ...base,
      rows: [
        { label: 'Subtotal', value: '$1,104' },
        { label: 'Total', value: '$1,247 USD', strong: true },
      ],
    })

    expect(html).toContain('Subtotal')
    expect(html).toContain('$1,104')
    expect(html).toMatch(/font-weight:600;color:#fafafa;">Total</)
    expect(html).toMatch(/font-weight:400;color:#a1a1aa;">Subtotal</)
  })

  test('links the footer at the canonical host', () => {
    const html = renderEmailHtml(base)
    expect(html).toContain(`href="${SITE_URL}"`)
    expect(html).not.toContain('www.nova-spatial.com')
  })

  test('falls back to a generic footnote', () => {
    expect(renderEmailHtml(base)).toContain('If you weren’t expecting')
    expect(renderEmailHtml({ ...base, footnote: 'Custom note.' })).toContain(
      'Custom note.',
    )
  })
})
