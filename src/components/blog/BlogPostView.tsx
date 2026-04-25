import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { MDXComponents } from '@/components/ui/MDXComponents'
import { PageLinks } from '@/components/ui/PageLinks'
import { RootLayout } from '@/components/layout/RootLayout'
import { formatDate } from '@/lib/formatDate'
import { loadPublishedPosts } from '@/lib/blog/posts'
import type { BlogPostWithAuthor } from '@/lib/blog/types'

export async function BlogPostView({
  post,
  children,
}: {
  post: BlogPostWithAuthor
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
              by {post.author.name}, {post.author.role}
            </p>
          </header>
        </FadeIn>

        <FadeIn>
          <MDXComponents.wrapper className="mt-24 sm:mt-32 lg:mt-40">
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
