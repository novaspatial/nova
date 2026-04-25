import Link from 'next/link'

import { FadeIn } from '@/components/ui/FadeIn'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/formatDate'
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
            <Button href="/blog/admin/blog/new">New post</Button>
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
        {posts.length === 0 ? (
          <FadeIn>
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center text-base text-zinc-400 sm:p-12">
              No posts yet. Click <strong>New post</strong> to write the first.
            </div>
          </FadeIn>
        ) : (
          <FadeIn>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/2">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          post.published_at
                            ? 'inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300'
                            : 'inline-flex items-center rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300'
                        }
                      >
                        {post.published_at ? 'Published' : 'Draft'}
                      </span>
                      <time
                        dateTime={post.post_date}
                        className="text-xs text-zinc-500"
                      >
                        {formatDate(post.post_date)}
                      </time>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-500">
                        {post.author.name}
                      </span>
                    </div>
                    <h2 className="mt-2 truncate font-display text-lg font-semibold text-white">
                      {post.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                      {post.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {post.published_at && (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                      >
                        View
                      </Link>
                    )}
                    <Link
                      href={`/blog/admin/blog/${post.id}/edit`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </FadeIn>
        )}
      </div>
    </div>
  )
}
