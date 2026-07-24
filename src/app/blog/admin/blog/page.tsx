import Link from 'next/link'

import { FadeIn } from '@/components/ui/FadeIn'
import { AdminPostsList } from '@/components/blog/admin/AdminPostsList'
import { loadAllPostsForAdmin } from '@/lib/blog/posts'

export default async function AdminBlogList() {
  const posts = await loadAllPostsForAdmin()

  return (
    <div>
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Blog posts
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/blog/admin/blog/new"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              New post
            </Link>
            <Link
              href="/blog"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              ← Blog
            </Link>
          </div>
        </div>
      </FadeIn>

      <div className="mt-8">
        <FadeIn>
          <AdminPostsList posts={posts} />
        </FadeIn>
      </div>
    </div>
  )
}
