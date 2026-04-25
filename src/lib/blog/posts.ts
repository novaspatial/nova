import 'server-only'

import { createClient } from '@/lib/supabase/supabaseServer'
import { getAuthor } from '@/lib/team'
import type { BlogPost, BlogPostWithAuthor } from './types'

const SELECT =
  'id, slug, title, description, body, author_key, post_date, published_at, created_by, created_at, updated_at'

function withAuthor(post: BlogPost): BlogPostWithAuthor | null {
  const author = getAuthor(post.author_key)
  if (!author) return null
  return { ...post, author }
}

export async function loadPublishedPosts(): Promise<BlogPostWithAuthor[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .not('published_at', 'is', null)
    .order('post_date', { ascending: false })

  if (error || !data) return []
  return (data as BlogPost[])
    .map(withAuthor)
    .filter((p): p is BlogPostWithAuthor => p !== null)
}

export async function loadPostBySlug(
  slug: string,
): Promise<BlogPostWithAuthor | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle()

  if (error || !data) return null
  return withAuthor(data as BlogPost)
}

export async function loadAllPostsForAdmin(): Promise<BlogPostWithAuthor[]> {
  const supabase = await createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return (data as BlogPost[])
    .map(withAuthor)
    .filter((p): p is BlogPostWithAuthor => p !== null)
}

export async function loadAdminPostById(id: string): Promise<BlogPost | null> {
  const supabase = await createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('blog_posts')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return data as BlogPost
}
