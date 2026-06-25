import Image from 'next/image'

import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { MDXComponents } from '@/components/ui/MDXComponents'
import { PageLinks } from '@/components/ui/PageLinks'
import { RootLayout } from '@/components/layout/RootLayout'
import { formatDate } from '@/lib/formatDate'
import type { HeroImage } from '@/lib/blog/extractHeroImage'
import { loadPublishedPosts } from '@/lib/blog/posts'
import type { BlogPostWithAuthor } from '@/lib/blog/types'

export async function BlogPostView({
  post,
  hero,
  children,
}: {
  post: BlogPostWithAuthor
  hero?: HeroImage | null
  children: React.ReactNode
}) {
  const allPosts = await loadPublishedPosts()
  const moreArticles = allPosts
    .filter((p) => p.id !== post.id)
    .slice(0, 2)
    .map((p) => ({
      href: `/blog/${p.slug}`,
      date: p.post_date,
      title: p.title,
      description: p.description,
    }))

  return (
    <RootLayout>
      <Container as="article" className="mt-24 sm:mt-32 lg:mt-40">
        <FadeIn>
          <header className="mx-auto flex max-w-5xl flex-col text-center">
            <h1 className="mt-6 font-display text-5xl font-medium tracking-tight text-balance text-white sm:text-6xl">
              {post.title}
            </h1>
            <time
              dateTime={post.post_date}
              className="order-first text-sm text-zinc-400"
            >
              {formatDate(post.post_date)}
            </time>
            <p className="mt-6 text-sm font-semibold text-white">
              by {post.author.name}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{post.author.role}</p>
          </header>
        </FadeIn>

        {hero && (
          <FadeIn>
            <div className="mx-auto mt-16 max-w-165 overflow-hidden rounded-4xl bg-white/5 sm:mt-20">
              <Image
                src={hero.src}
                alt={hero.alt}
                width={1280}
                height={800}
                priority
                sizes="(min-width: 768px) 41.25rem, 100vw"
                className="aspect-16/10 w-full object-cover"
              />
            </div>
          </FadeIn>
        )}

        <FadeIn>
          <MDXComponents.wrapper className="mt-16 sm:mt-20">
            {children}
          </MDXComponents.wrapper>
        </FadeIn>
      </Container>

      {moreArticles.length > 0 && (
        <PageLinks
          className="mt-24 sm:mt-32 lg:mt-40"
          title="More articles"
          pages={moreArticles}
        />
      )}
    </RootLayout>
  )
}
