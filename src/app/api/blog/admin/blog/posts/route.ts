import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

import { forbiddenResponse, requireApiProfile } from '@/lib/auth/server'
import { getAuthor } from '@/lib/team'

export async function POST(request: NextRequest) {
  const auth = await requireApiProfile()
  if ('response' in auth) return auth.response
  if (auth.profile?.role !== 'studio') return forbiddenResponse()

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

  const required = ['title', 'slug', 'description', 'body', 'author_key', 'post_date'] as const
  for (const key of required) {
    if (typeof body[key] !== 'string' || !body[key]) {
      return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 })
    }
  }
  if (!getAuthor(body.author_key!)) {
    return NextResponse.json({ error: 'Unknown author_key' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('blog_posts')
    .insert({
      title: body.title!,
      slug: body.slug!,
      description: body.description!,
      body: body.body!,
      author_key: body.author_key!,
      post_date: body.post_date!,
      published_at: body.published_at ?? null,
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    const isUnique = error?.code === '23505'
    return NextResponse.json(
      { error: isUnique ? 'A post with that slug already exists.' : error?.message ?? 'Insert failed' },
      { status: isUnique ? 409 : 500 },
    )
  }

  revalidatePath('/blog')
  if (body.published_at) revalidatePath(`/blog/${body.slug!}`)

  return NextResponse.json({ id: data.id })
}
