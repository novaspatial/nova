import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BlogPostView } from '@/components/blog/BlogPostView'
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import { extractHeroImage } from '@/lib/blog/extractHeroImage'
import { loadPostBySlug } from '@/lib/blog/posts'

type Params = Promise<{ slug: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const post = await loadPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
  }
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params
  const post = await loadPostBySlug(slug)
  if (!post) notFound()

  const { hero, body } = extractHeroImage(post.body)

  return (
    <BlogPostView post={post} hero={hero}>
      <MarkdownRenderer>{body}</MarkdownRenderer>
    </BlogPostView>
  )
}
