import { notFound } from 'next/navigation'

import { BlogPostEditor } from '@/components/portal/admin/BlogPostEditor'
import { loadAdminPostById } from '@/lib/blog/posts'

type Params = Promise<{ id: string }>

export default async function EditBlogPostPage({ params }: { params: Params }) {
  const { id } = await params
  const post = await loadAdminPostById(id)
  if (!post) notFound()
  return <BlogPostEditor mode="edit" initial={post} />
}
