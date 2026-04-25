import type { TeamMember } from '@/lib/team'

export type BlogPost = {
  id: string
  slug: string
  title: string
  description: string
  body: string
  author_key: string
  post_date: string
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BlogPostWithAuthor = BlogPost & { author: TeamMember }

export type BlogPostInput = {
  slug: string
  title: string
  description: string
  body: string
  author_key: string
  post_date: string
  published_at: string | null
}
