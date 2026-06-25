import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { BlogPostWithAuthor } from '@/lib/blog/types'

// No "more articles" so PageLinks doesn't render; keeps the tree light.
vi.mock('@/lib/blog/posts', () => ({
  loadPublishedPosts: vi.fn(async () => []),
}))
// Stub heavy layout/animation wrappers so jsdom can render the view.
vi.mock('@/components/layout/RootLayout', () => ({
  RootLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/FadeIn', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

import { BlogPostView } from './BlogPostView'

const post: BlogPostWithAuthor = {
  id: '1',
  slug: 's',
  title: 'My Title',
  description: 'd',
  body: 'b',
  author_key: 'jamie-kuse',
  post_date: '2026-04-25',
  published_at: '2026-04-25T00:00:00Z',
  created_by: null,
  created_at: '2026-04-25T00:00:00Z',
  updated_at: '2026-04-25T00:00:00Z',
  author: {
    slug: 'jamie-kuse',
    name: 'Jamie Kuse',
    role: 'Rap/R&B, Pop, Electronic',
    bio: 'x',
    image: { src: {} as never },
  },
}

describe('BlogPostView', () => {
  test('renders the hero image once when a hero is provided', async () => {
    const ui = await BlogPostView({
      post,
      hero: { src: 'https://cdn/hero.jpg', alt: 'hero' },
      children: <div>body</div>,
    })
    render(ui)
    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('src', 'https://cdn/hero.jpg')
  })

  test('renders no hero image when hero is null', async () => {
    const ui = await BlogPostView({
      post,
      hero: null,
      children: <div>body</div>,
    })
    render(ui)
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('splits the byline name from the author role', async () => {
    const ui = await BlogPostView({
      post,
      hero: null,
      children: <div>body</div>,
    })
    render(ui)
    expect(screen.getByText('by Jamie Kuse')).toBeInTheDocument()
    expect(screen.getByText('Rap/R&B, Pop, Electronic')).toBeInTheDocument()
    // Name and role are separate elements, not one "by X, Y" string.
    expect(screen.queryByText(/by Jamie Kuse,/)).toBeNull()
  })
})
