import { createClient } from '@/lib/supabase/supabaseClient'

const MAX_BYTES = 20 * 1024 * 1024
const BUCKET = 'blog-assets'

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

function safeFileName(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  const stem = name
    .slice(0, name.length - ext.length)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${stem || 'image'}-${Date.now()}${ext.toLowerCase()}`
}

export async function uploadBlogImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Only image files are allowed.' }
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be under 20 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    }
  }

  const supabase = createClient()
  if (!supabase) {
    return { ok: false, error: 'Supabase client unavailable.' }
  }

  const path = `posts/${safeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { ok: false, error: uploadError.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    return { ok: false, error: 'Could not resolve public URL.' }
  }
  return { ok: true, url: data.publicUrl }
}
