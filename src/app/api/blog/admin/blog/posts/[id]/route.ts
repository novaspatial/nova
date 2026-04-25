import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

import { forbiddenResponse, requireApiProfile } from '@/lib/auth/server'
import { getAuthor } from '@/lib/team'

type Params = Promise<{ id: string }>

function revalidateBlog(slugs: Array<string | null | undefined>) {
  revalidatePath('/blog')
  for (const slug of slugs) {
    if (slug) revalidatePath(`/blog/${slug}`)
  }
}

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
    .select('slug')
    .eq('id', id)
    .maybeSingle()

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

  revalidateBlog([existing?.slug, body.slug])

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
    .select('slug')
    .eq('id', id)
    .maybeSingle()

  const { error } = await auth.supabase.from('blog_posts').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateBlog([existing?.slug])

  return NextResponse.json({ ok: true })
}
