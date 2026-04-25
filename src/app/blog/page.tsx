import { type Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'

import { Border } from '@/components/ui/Border'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { PageIntro } from '@/components/ui/PageIntro'
import { RootLayout } from '@/components/layout/RootLayout'
import { formatDate } from '@/lib/formatDate'
import { loadPublishedPosts } from '@/lib/blog/posts'
import { createClient } from '@/lib/supabase/supabaseServer'
import { getAuthProfile } from '@/lib/auth/server'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Stay up-to-date with the latest industry news as our marketing teams finds new ways to re-purpose old CSS tricks articles.',
}

async function ArticlesList() {
  const posts = await loadPublishedPosts()

  return (
    <div className="space-y-24 lg:space-y-32">
      {posts.map((post) => {
        const href = `/blog/${post.slug}`
        return (
          <FadeIn key={post.id}>
            <article>
              <Border className="pt-16">
                <div className="relative lg:-mx-4 lg:flex lg:justify-end">
                  <div className="pt-10 lg:w-2/3 lg:flex-none lg:px-4 lg:pt-0">
                    <h2 className="font-display text-2xl font-semibold text-white">
                      <Link href={href}>{post.title}</Link>
                    </h2>
                    <dl className="lg:absolute lg:top-0 lg:left-0 lg:w-1/3 lg:px-4">
                      <dt className="sr-only">Published</dt>
                      <dd className="absolute top-0 left-0 text-sm text-zinc-400 lg:static">
                        <time dateTime={post.post_date}>
                          {formatDate(post.post_date)}
                        </time>
                      </dd>
                      <dt className="sr-only">Author</dt>
                      <dd className="mt-6 flex gap-x-4">
                        <div className="flex-none overflow-hidden rounded-xl bg-white/10">
                          <Image
                            alt=""
                            src={post.author.image.src}
                            className="h-12 w-12 object-cover grayscale"
                          />
                        </div>
                        <div className="text-sm text-white">
                          <div className="font-semibold">
                            {post.author.name}
                          </div>
                          <div>{post.author.role}</div>
                        </div>
                      </dd>
                    </dl>
                    <p className="mt-6 max-w-2xl text-base text-zinc-300">
                      {post.description}
                    </p>
                    <Button
                      href={href}
                      aria-label={`Read more: ${post.title}`}
                      className="mt-8 bg-none! bg-zinc-800/90! text-zinc-200! shadow-none! ring-1 ring-white/10 hover:bg-zinc-700/90! hover:text-white! hover:shadow-none! hover:scale-100! hover:ring-white/25"
                    >
                      Read more
                    </Button>
                  </div>
                </div>
              </Border>
            </article>
          </FadeIn>
        )
      })}
    </div>
  )
}

async function isStudioViewer(): Promise<boolean> {
  const supabase = await createClient()
  if (!supabase) return false
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const profile = await getAuthProfile(supabase, user.id)
  return profile?.role === 'studio'
}

export default async function Blog() {
  const showAdminLink = await isStudioViewer()

  return (
    <RootLayout>
      <div className="relative">
        <PageIntro eyebrow="Blog" title="The latest articles and news">
          <p>
            Stay up-to-date with the latest industry news as our marketing teams
            finds new ways to re-purpose old CSS tricks articles.
          </p>
        </PageIntro>

        {showAdminLink && (
          <Container className="pointer-events-none absolute inset-x-0 top-0 mt-24 sm:mt-32 lg:mt-40">
            <div className="flex justify-end">
              <Link
                href="/blog/admin/blog"
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-zinc-800/90 px-4 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-zinc-700/90 hover:text-white hover:ring-white/25"
              >
                Edit Blogs
              </Link>
            </div>
          </Container>
        )}
      </div>

      <Container className="mt-24 sm:mt-32 lg:mt-40">
        <Suspense fallback={<div className="text-white text-center">Loading articles...</div>}>
          <ArticlesList />
        </Suspense>
      </Container>
    </RootLayout>
  )
}
