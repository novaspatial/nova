/**
 * One-shot port of legacy MDX blog posts into the blog_posts table.
 *
 * Run once after applying the 20260425 migrations:
 *   npm run seed:blog
 *
 * For each src/app/blog/<slug>/page.mdx:
 *   - parses date/title/description/author.name from the exported `article` object,
 *   - uploads the post's local JPGs to the blog-assets bucket under seed/<slug>/,
 *   - rewrites `./image.jpg` references in the body to public URLs,
 *   - rewrites <TopTip>...</TopTip> JSX into ```top-tip / ``` shortcodes,
 *   - upserts a published row keyed by slug.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any>

// Inlined to avoid tsx loading the .jpg imports in src/lib/team.ts.
// Keep in sync with TEAM_MEMBERS in src/lib/team.ts.
const NAME_TO_SLUG: Record<string, string> = {
  'Jamie Kuse': 'jamie-kuse',
  'Will Howie': 'will-howie',
  'Mike Southworth': 'mike-southworth',
  'Daniel Byrne': 'daniel-byrne',
  'Doug Fury': 'doug-fury',
  'Gabriel Macdonald': 'gabriel-macdonald',
}

const BLOG_DIR = path.resolve('src/app/blog')
const BUCKET = 'blog-assets'

function nameToAuthorKey(name: string): string | null {
  return NAME_TO_SLUG[name] ?? null
}

type ParsedArticle = {
  date: string
  title: string
  description: string
  authorName: string
}

function unquote(s: string): string {
  return s
    .replace(/^['"`]/, '')
    .replace(/['"`]$/, '')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
}

function parseArticle(source: string): ParsedArticle {
  const match = source.match(
    /export const article = \{([\s\S]*?)\n\}/m,
  )
  if (!match) throw new Error('Could not find `export const article` block')
  const block = match[1]

  const dateMatch = block.match(/date:\s*(['"`][^'"`]+['"`])/)
  const titleMatch = block.match(/title:\s*(['"`][^'"`]+['"`])/)
  // description may span lines; allow a quoted string with possible escaped quotes.
  const descMatch = block.match(/description:\s*\n?\s*(['"`])([\s\S]*?)\1\s*,/)
  const nameMatch = block.match(/name:\s*(['"`][^'"`]+['"`])/)

  if (!dateMatch || !titleMatch || !descMatch || !nameMatch) {
    throw new Error('Article block missing required fields')
  }

  return {
    date: unquote(dateMatch[1]),
    title: unquote(titleMatch[1]),
    description: descMatch[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim(),
    authorName: unquote(nameMatch[1]),
  }
}

function stripFrontmatter(source: string): string {
  // Drop import lines and `export const ...` blocks so only the markdown body remains.
  const withoutImports = source.replace(/^import .*$/gm, '')
  const withoutExports = withoutImports.replace(
    /^export const \w+ = \{[\s\S]*?\n\}\s*$/gm,
    '',
  )
  return withoutExports.replace(/^\s*\n+/, '')
}

function rewriteTopTip(body: string): string {
  return body.replace(
    /<TopTip>\s*([\s\S]*?)\s*<\/TopTip>/g,
    (_match, inner: string) => {
      // Collapse leading indentation that the JSX block had.
      const cleaned = inner
        .split('\n')
        .map((line) => line.replace(/^\s{2}/, ''))
        .join('\n')
        .trim()
      return '```top-tip\n' + cleaned + '\n```'
    },
  )
}

async function uploadImage(
  supabase: AnyClient,
  slug: string,
  localPath: string,
): Promise<string> {
  const file = await readFile(localPath)
  const filename = path.basename(localPath)
  const storagePath = `seed/${slug}/${filename}`
  const { error } = await supabase.storage.from(BUCKET).upload(
    storagePath,
    file,
    {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: true,
    },
  )
  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`)
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  if (!data?.publicUrl) {
    throw new Error(`No public URL for ${storagePath}`)
  }
  return data.publicUrl
}

async function processPost(
  supabase: AnyClient,
  slug: string,
) {
  const dir = path.join(BLOG_DIR, slug)
  const mdxPath = path.join(dir, 'page.mdx')
  const source = await readFile(mdxPath, 'utf8')

  const article = parseArticle(source)
  const authorKey = nameToAuthorKey(article.authorName)
  if (!authorKey) {
    throw new Error(`No team member named "${article.authorName}"`)
  }

  let body = stripFrontmatter(source)
  body = rewriteTopTip(body)

  // Upload every local image referenced as `./<file>` in the markdown.
  const imageRefs = [...body.matchAll(/!\[([^\]]*)\]\(\.\/([^)]+)\)/g)]
  for (const ref of imageRefs) {
    const filename = ref[2]
    const url = await uploadImage(supabase, slug, path.join(dir, filename))
    body = body.split(ref[0]).join(`![${ref[1]}](${url})`)
  }

  const { error: upsertError } = await supabase.from('blog_posts').upsert(
    {
      slug,
      title: article.title,
      description: article.description,
      body: body.trim() + '\n',
      author_key: authorKey,
      post_date: article.date,
      published_at: new Date(`${article.date}T12:00:00Z`).toISOString(),
    },
    { onConflict: 'slug' },
  )
  if (upsertError) {
    throw new Error(`Upsert failed for ${slug}: ${upsertError.message}`)
  }

  console.log(`✓ ${slug} (${imageRefs.length} images)`)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as AnyClient

  const entries = await readdir(BLOG_DIR, { withFileTypes: true })
  const slugs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('['))
    .map((e) => e.name)

  for (const slug of slugs) {
    try {
      await processPost(supabase, slug)
    } catch (e) {
      console.error(`✗ ${slug}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }

  if (process.exitCode !== 1) {
    console.log('\nNext step — delete the legacy MDX (and the now-unused loader):')
    for (const slug of slugs) {
      console.log(`  rm -rf src/app/blog/${slug}`)
    }
    console.log('  rm src/lib/mdx.ts')
  }
}

void main()
