'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Pagination } from '@/components/ui/Pagination'
import { formatDate } from '@/lib/formatDate'
import type { BlogPostWithAuthor } from '@/lib/blog/types'

const PAGE_SIZE = 5

export function AdminPostsList({ posts }: { posts: BlogPostWithAuthor[] }) {
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visiblePosts = posts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center text-base text-zinc-400 sm:p-12">
        No posts yet. Click <strong>New post</strong> to write the first.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/2">
        {visiblePosts.map((post) => (
          <li
            key={post.id}
            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={
                    post.published_at
                      ? 'inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase'
                      : 'inline-flex items-center rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-300 uppercase'
                  }
                >
                  {post.published_at ? 'Published' : 'Draft'}
                </span>
                <time dateTime={post.post_date} className="text-xs text-zinc-500">
                  {formatDate(post.post_date)}
                </time>
                <span className="text-xs text-zinc-500">·</span>
                <span className="text-xs text-zinc-500">{post.author.name}</span>
              </div>
              <h2 className="font-display mt-2 truncate text-lg font-semibold text-white">
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

      {posts.length > PAGE_SIZE && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
