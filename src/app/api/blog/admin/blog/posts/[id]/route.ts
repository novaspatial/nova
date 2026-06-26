import { NextResponse, type NextRequest } from 'next/server'

import { forbiddenResponse, requireApiProfile } from '@/lib/auth/server'
import { onPostMutated } from '@/lib/blog/onPostMutated'
import { getAuthor } from '@/lib/team'

type Params = Promise<{ id: string }>

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await requireApiProfile()
  if ('response' in auth) return auth.response
  if (auth.profile?.role !== 'studio') return forbiddenResponse()

  const { id } = await params

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string
        slug?: string
        description?: string
        body?: string
        author_key?: string
        post_date?: string
        published_at?: string | null
      }
    | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.author_key !== undefined && !getAuthor(body.author_key)) {
    return NextResponse.json({ error: 'Unknown author_key' }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from('blog_posts')
    .select('slug, published_at')
    .eq('id', id)
    .maybeSingle()

  const existingSlug = (existing as { slug?: string | null } | null)?.slug ?? null
  const existingPublishedAt =
    (existing as { published_at?: string | null } | null)?.published_at ?? null

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['title', 'slug', 'description', 'body', 'author_key', 'post_date'] as const) {
    if (typeof body[key] === 'string') update[key] = body[key]
  }
  if (body.published_at !== undefined) update.published_at = body.published_at

  const { error } = await auth.supabase
    .from('blog_posts')
    .update(update)
    .eq('id', id)

  if (error) {
    const isUnique = error.code === '23505'
    return NextResponse.json(
      { error: isUnique ? 'A post with that slug already exists.' : error.message },
      { status: isUnique ? 409 : 500 },
    )
  }

  const newSlug = typeof body.slug === 'string' ? body.slug : undefined
  const resultingPublishedAt =
    body.published_at !== undefined ? body.published_at : existingPublishedAt

  await onPostMutated({
    type: 'updated',
    slug: newSlug ?? existingSlug,
    previousSlug: newSlug && newSlug !== existingSlug ? existingSlug : undefined,
    isPublished: resultingPublishedAt !== null,
    wasPublished: existingPublishedAt !== null,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await requireApiProfile()
  if ('response' in auth) return auth.response
  if (auth.profile?.role !== 'studio') return forbiddenResponse()

  const { id } = await params

  const { data: existing } = await auth.supabase
    .from('blog_posts')
    .select('slug, published_at')
    .eq('id', id)
    .maybeSingle()

  const { error } = await auth.supabase.from('blog_posts').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const removed = existing as { slug?: string | null; published_at?: string | null } | null
  await onPostMutated({
    type: 'deleted',
    slug: removed?.slug ?? null,
    isPublished: false,
    wasPublished: (removed?.published_at ?? null) !== null,
  })

  return NextResponse.json({ ok: true })
}
