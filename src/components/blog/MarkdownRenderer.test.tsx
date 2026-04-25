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
