import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { StaticImageData } from 'next/image'
import type { BlogPostWithAuthor } from '@/lib/blog/types'

import { AdminPostsList } from './AdminPostsList'

function makePost(i: number): BlogPostWithAuthor {
  return {
    id: `post-${i}`,
    slug: `post-${i}`,
    title: `Post ${i}`,
    description: `Description ${i}`,
    body: 'Body',
    author_key: 'jamie-kuse',
    post_date: '2026-07-01',
    published_at: '2026-07-01T00:00:00.000Z',
    created_by: 'studio-1',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    author: {
      slug: 'jamie-kuse',
      name: 'Jamie Kuse',
      role: 'Engineer',
      bio: '',
      image: { src: { src: '/jamie.jpg', height: 1, width: 1 } as StaticImageData },
    },
  }
}

describe('AdminPostsList', () => {
  test('shows the empty state without posts', () => {
    render(<AdminPostsList posts={[]} />)
    expect(screen.getByText(/No posts yet/)).toBeInTheDocument()
  })

  test('paginates only past 5 posts', () => {
    render(
      <AdminPostsList posts={Array.from({ length: 7 }, (_, i) => makePost(i))} />,
    )

    expect(screen.getByText('Post 0')).toBeInTheDocument()
    expect(screen.getByText('Post 4')).toBeInTheDocument()
    expect(screen.queryByText('Post 5')).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Post 5')).toBeInTheDocument()
    expect(screen.getByText('Post 6')).toBeInTheDocument()
    expect(screen.queryByText('Post 0')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  test('hides pagination at 5 or fewer posts', () => {
    render(
      <AdminPostsList posts={Array.from({ length: 5 }, (_, i) => makePost(i))} />,
    )

    expect(screen.getByText('Post 4')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next page' }),
    ).not.toBeInTheDocument()
  })
})
