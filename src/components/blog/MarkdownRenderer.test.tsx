import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Stub heavy components so jsdom can render without scroll/animation deps.
vi.mock('@/components/ui/GrayscaleTransitionImage', () => ({
  GrayscaleTransitionImage: ({ src, alt }: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} />
  ),
}))

import { MarkdownRenderer } from './MarkdownRenderer'

describe('MarkdownRenderer', () => {
  test('renders markdown headings and paragraphs', () => {
    render(<MarkdownRenderer>{`## Title\n\nHello world.`}</MarkdownRenderer>)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title')
    expect(screen.getByText('Hello world.')).toBeInTheDocument()
  })

  test('renders images by URL through the image wrapper', () => {
    render(
      <MarkdownRenderer>
        {`![alt text](https://cdn.example/img.jpg)`}
      </MarkdownRenderer>,
    )
    const img = screen.getByAltText('alt text') as HTMLImageElement
    expect(img.src).toBe('https://cdn.example/img.jpg')
  })

  test('renders ```top-tip fenced blocks as a TOP TIP callout', () => {
    render(
      <MarkdownRenderer>
        {'```top-tip\nDont skip lunch.\n```'}
      </MarkdownRenderer>,
    )
    expect(screen.getByText(/top tip/i)).toBeInTheDocument()
    expect(screen.getByText('Dont skip lunch.')).toBeInTheDocument()
    // The default <pre><code> rendering should not appear for this shortcode.
    expect(document.querySelector('pre code.language-top-tip')).toBeNull()
  })

  test('renders ```apple-music fenced blocks as an Apple Music callout', () => {
    render(
      <MarkdownRenderer>
        {'```apple-music\nhttps://music.apple.com/ca/album/x/1\nListen in spatial audio.\n```'}
      </MarkdownRenderer>,
    )
    const link = screen.getByRole('link', { name: /apple music/i })
    expect(link).toHaveAttribute('href', 'https://music.apple.com/ca/album/x/1')
    expect(screen.getByText(/listen in spatial audio/i)).toBeInTheDocument()
    // The default <pre><code> rendering should not appear for this shortcode.
    expect(document.querySelector('pre code.language-apple-music')).toBeNull()
  })

  test('adds clean slug ids to headings (rehype-slug)', () => {
    render(<MarkdownRenderer>{`## My Heading`}</MarkdownRenderer>)
    const heading = screen.getByRole('heading', { level: 2 })
    // No `user-content-` clobber prefix: ids stay clean for fragment links.
    expect(heading).toHaveAttribute('id', 'my-heading')
  })

  test('renders markdown blockquotes as <blockquote>', () => {
    render(<MarkdownRenderer>{'> A quote.'}</MarkdownRenderer>)
    expect(screen.getByText('A quote.').closest('blockquote')).not.toBeNull()
  })

  test('renders a single image node per inline image', () => {
    render(
      <MarkdownRenderer>
        {`![x](https://cdn.example/x.jpg)`}
      </MarkdownRenderer>,
    )
    expect(document.querySelectorAll('img')).toHaveLength(1)
  })

  test('strips raw <script> tags via rehype-sanitize', () => {
    render(
      <MarkdownRenderer>
        {`Hello\n\n<script>window.__pwn=true</script>`}
      </MarkdownRenderer>,
    )
    expect(document.querySelector('script')).toBeNull()
    // The rest of the content should still render.
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
