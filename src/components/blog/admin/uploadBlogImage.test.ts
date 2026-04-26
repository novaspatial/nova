import { describe, expect, test, vi, beforeEach } from 'vitest'

import { createClient } from '@/lib/supabase/supabaseClient'
import { uploadBlogImage } from './uploadBlogImage'

// vitest.setup.ts auto-mocks @/lib/supabase/supabaseClient — we drive the
// returned client per-test via vi.mocked(createClient).
const mockedCreateClient = vi.mocked(createClient)

function makeFile({
  name = 'photo.jpg',
  type = 'image/jpeg',
  size = 1024,
}: Partial<{ name: string; type: string; size: number }> = {}): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  // Construct a real File so `file.size`, `file.type`, and `file.name` behave.
  return new File([blob], name, { type })
}

function makeStorageStub({
  uploadError = null as { message: string } | null,
  publicUrl = 'https://cdn.example/blog-assets/posts/photo.jpg' as string | null,
} = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError })
  const getPublicUrl = vi.fn(() => ({
    data: publicUrl ? { publicUrl } : null,
  }))
  const from = vi.fn(() => ({ upload, getPublicUrl }))
  return {
    client: { storage: { from } },
    upload,
    getPublicUrl,
    from,
  }
}

describe('uploadBlogImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('rejects non-image MIME types without touching supabase', async () => {
    const stub = makeStorageStub()
    mockedCreateClient.mockReturnValue(stub.client as never)

    const result = await uploadBlogImage(
      makeFile({ type: 'application/pdf', name: 'doc.pdf' }),
    )
    expect(result).toEqual({ ok: false, error: 'Only image files are allowed.' })
    expect(stub.from).not.toHaveBeenCalled()
  })

  test('rejects files larger than 20 MB', async () => {
    const stub = makeStorageStub()
    mockedCreateClient.mockReturnValue(stub.client as never)

    const result = await uploadBlogImage(
      makeFile({ size: 21 * 1024 * 1024 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/under 20 MB/)
    expect(stub.from).not.toHaveBeenCalled()
  })

  test('returns the public URL on a successful upload', async () => {
    const stub = makeStorageStub({
      publicUrl: 'https://cdn.example/blog-assets/posts/photo.jpg',
    })
    mockedCreateClient.mockReturnValue(stub.client as never)

    const result = await uploadBlogImage(makeFile({ size: 100 }))
    expect(result).toEqual({
      ok: true,
      url: 'https://cdn.example/blog-assets/posts/photo.jpg',
    })
    expect(stub.from).toHaveBeenCalledWith('blog-assets')
  })

  test('uploads under posts/ with a sanitized, time-stamped filename', async () => {
    const stub = makeStorageStub()
    mockedCreateClient.mockReturnValue(stub.client as never)

    await uploadBlogImage(
      makeFile({ name: 'My Cool Photo!! (final).JPG', type: 'image/jpeg' }),
    )

    expect(stub.upload).toHaveBeenCalledTimes(1)
    const [storagePath, , opts] = stub.upload.mock.calls[0]
    expect(storagePath).toMatch(
      /^posts\/my-cool-photo-final-\d+\.jpg$/,
    )
    expect(opts).toMatchObject({
      contentType: 'image/jpeg',
      upsert: false,
    })
  })

  test('falls back to "image" when the filename has no usable characters', async () => {
    const stub = makeStorageStub()
    mockedCreateClient.mockReturnValue(stub.client as never)

    await uploadBlogImage(makeFile({ name: '!!.png', type: 'image/png' }))

    const [storagePath] = stub.upload.mock.calls[0]
    expect(storagePath).toMatch(/^posts\/image-\d+\.png$/)
  })

  test('returns an error when supabase is not configured', async () => {
    mockedCreateClient.mockReturnValue(null as never)

    const result = await uploadBlogImage(makeFile())
    expect(result).toEqual({ ok: false, error: 'Supabase client unavailable.' })
  })

  test('surfaces upload errors from supabase storage', async () => {
    const stub = makeStorageStub({
      uploadError: { message: 'bucket policy denied' },
    })
    mockedCreateClient.mockReturnValue(stub.client as never)

    const result = await uploadBlogImage(makeFile())
    expect(result).toEqual({ ok: false, error: 'bucket policy denied' })
  })

  test('returns an error when the public URL cannot be resolved', async () => {
    const stub = makeStorageStub({ publicUrl: null })
    mockedCreateClient.mockReturnValue(stub.client as never)

    const result = await uploadBlogImage(makeFile())
    expect(result).toEqual({ ok: false, error: 'Could not resolve public URL.' })
  })
})
