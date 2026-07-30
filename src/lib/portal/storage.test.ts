import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  createSupabaseMock,
  createChainMock,
  createMockRequest,
} from '@/test/helpers/supabaseMock'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/supabaseServer', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import {
  MAX_UPLOAD_BYTES,
  SIGNED_URL_TTL_SECONDS,
  attachmentDownloadRoute,
  bucketFor,
  createUpload,
  isCommentAttachmentPath,
  pathFor,
  removeStorageObjects,
  signedDownload,
  stemDownloadRoute,
  tableFor,
  validateUploadInput,
  MAX_FILE_NAME_LENGTH,
} from './storage'

type SupabaseMock = ReturnType<typeof createSupabaseMock>

function asClient(mock: SupabaseMock) {
  return mock as unknown as SupabaseClient
}

describe('bucketFor / tableFor', () => {
  test('every kind shares the uploads bucket', () => {
    for (const kind of ['stem', 'master_ref', 'mix', 'comment_attachment'] as const) {
      expect(bucketFor(kind)).toBe('project-uploads')
    }
  })

  test('maps each kind to its child table', () => {
    expect(tableFor('stem')).toBe('project_files')
    expect(tableFor('master_ref')).toBe('project_files')
    expect(tableFor('mix')).toBe('project_files')
    expect(tableFor('comment_attachment')).toBe('project_comment_attachments')
  })
})

describe('pathFor', () => {
  const ctx = { ownerId: 'owner-1', projectId: 'proj-1', fileName: 'kick.wav' }

  test('stems and master refs use the flat template', () => {
    expect(pathFor('stem', ctx)).toBe('owner-1/proj-1/kick.wav')
    expect(pathFor('master_ref', ctx)).toBe('owner-1/proj-1/kick.wav')
  })

  test('mixes get their subfolder', () => {
    expect(pathFor('mix', ctx)).toBe('owner-1/proj-1/mixes/kick.wav')
  })

  test('comment attachments nest under a uuid and sanitize the name', () => {
    expect(
      pathFor('comment_attachment', {
        ...ctx,
        fileName: 'my note (1).pdf',
        attachmentId: 'uuid-1',
      }),
    ).toBe('owner-1/proj-1/comments/uuid-1/my_note__1_.pdf')
  })
})

describe('isCommentAttachmentPath', () => {
  test('accepts paths inside the project comments subtree only', () => {
    expect(
      isCommentAttachmentPath('proj-1', 'owner/proj-1/comments/u/f.wav'),
    ).toBe(true)
    expect(isCommentAttachmentPath('proj-1', 'owner/proj-2/comments/u/f.wav')).toBe(
      false,
    )
    expect(isCommentAttachmentPath('proj-1', 'owner/proj-1/f.wav')).toBe(false)
  })
})

describe('validateUploadInput', () => {
  const valid = { fileName: 'kick.wav', fileSize: 1024, mimeType: 'audio/wav' }

  test('passes a well-formed input', () => {
    expect(validateUploadInput('stem', valid)).toBeNull()
  })

  test('keeps the exact presence message', () => {
    expect(validateUploadInput('stem', {})).toBe(
      'fileName, fileSize, and mimeType are required',
    )
    expect(validateUploadInput('comment_attachment', {})).toBe(
      'fileName, fileSize, and mimeType are required',
    )
  })

  test('rejects path-like file names', () => {
    for (const fileName of ['../evil.wav', 'a/b.wav', 'a\\b.wav', '..']) {
      expect(validateUploadInput('stem', { ...valid, fileName })).toBe(
        'fileName must be a plain file name',
      )
    }
  })

  test('rejects non-positive and oversized files', () => {
    expect(validateUploadInput('stem', { ...valid, fileSize: -5 })).toBe(
      'fileSize must be a positive number of bytes',
    )
    expect(validateUploadInput('stem', { ...valid, fileSize: '500' })).toBe(
      'fileSize must be a positive number of bytes',
    )
    expect(
      validateUploadInput('stem', { ...valid, fileSize: MAX_UPLOAD_BYTES + 1 }),
    ).toBe('File exceeds the 5 GB upload limit')
    expect(
      validateUploadInput('stem', { ...valid, fileSize: MAX_UPLOAD_BYTES }),
    ).toBeNull()
  })

  test('rejects malformed MIME types', () => {
    expect(validateUploadInput('stem', { ...valid, mimeType: 'not a mime' })).toBe(
      'mimeType must be a valid MIME type',
    )
  })

  test.each([
    'audio/wav',
    'audio/x-aiff',
    'audio/flac',
    'audio/mpeg',
    // What browsers actually report for .wav/.aif more often than not.
    'application/octet-stream',
    'application/zip',
  ])('accepts %s for audio uploads', (mimeType) => {
    expect(validateUploadInput('stem', { ...valid, mimeType })).toBeNull()
  })

  test.each(['text/html', 'application/x-msdownload', 'application/javascript'])(
    'rejects %s (#57)',
    (mimeType) => {
      expect(validateUploadInput('stem', { ...valid, mimeType })).toBe(
        'This file type is not accepted',
      )
    },
  )

  test('comment attachments accept images and PDFs but never SVG', () => {
    const attachment = { fileName: 'note.png', fileSize: 10 }
    expect(
      validateUploadInput('comment_attachment', {
        ...attachment,
        mimeType: 'image/png',
      }),
    ).toBeNull()
    expect(
      validateUploadInput('comment_attachment', {
        ...attachment,
        mimeType: 'application/pdf',
      }),
    ).toBeNull()
    // SVG executes script when served inline from a signed URL.
    expect(
      validateUploadInput('comment_attachment', {
        ...attachment,
        mimeType: 'image/svg+xml',
      }),
    ).toBe('This file type is not accepted')
  })

  test('caps the file name length', () => {
    expect(
      validateUploadInput('stem', {
        ...valid,
        fileName: `${'x'.repeat(MAX_FILE_NAME_LENGTH)}.wav`,
      }),
    ).toBe(`fileName must be ${MAX_FILE_NAME_LENGTH} characters or fewer`)
  })
})

describe('createUpload', () => {
  beforeEach(() => vi.clearAllMocks())

  const ctx = {
    projectId: 'proj-1',
    ownerId: 'owner-1',
    fileName: 'kick.wav',
    fileSize: 1024,
    mimeType: 'audio/wav',
    uploadedBy: 'user-1',
  }

  test('returns a 400 result on invalid input without touching storage', async () => {
    const supabase = createSupabaseMock()
    const result = await createUpload(asClient(supabase), 'stem', {
      ...ctx,
      fileName: undefined,
    })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'fileName, fileSize, and mimeType are required',
    })
    expect(supabase.storage.from).not.toHaveBeenCalled()
  })

  test('stem: signs the upload URL first, then inserts the row', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/put' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { id: 'file-1', storage_path: 'owner-1/proj-1/kick.wav' },
      error: null,
    })
    // No row yet at this path — the register probe finds nothing (#57).
    filesChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
      storageMocks: { 'project-uploads': { createSignedUploadUrl } },
    })

    const result = await createUpload(asClient(supabase), 'stem', ctx)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row?.id).toBe('file-1')
      expect(result.uploadUrl).toBe('https://storage.example.com/put')
      expect(result.storagePath).toBe('owner-1/proj-1/kick.wav')
    }
    expect(createSignedUploadUrl).toHaveBeenCalledWith('owner-1/proj-1/kick.wav', {
      upsert: true,
    })
    expect(filesChain.insert).toHaveBeenCalledWith({
      project_id: 'proj-1',
      file_name: 'kick.wav',
      file_size: 1024,
      mime_type: 'audio/wav',
      file_type: 'stem',
      storage_path: 'owner-1/proj-1/kick.wav',
      upload_status: 'pending',
      uploaded_by: 'user-1',
    })
  })

  test('mix: upserts the storage object and pathFors into mixes/', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/put' },
      error: null,
    })
    const filesChain = createChainMock({ data: { id: 'file-2' }, error: null })
    filesChain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
      storageMocks: { 'project-uploads': { createSignedUploadUrl } },
    })

    const result = await createUpload(asClient(supabase), 'mix', ctx)

    expect(result.ok).toBe(true)
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      'owner-1/proj-1/mixes/kick.wav',
      { upsert: true },
    )
    expect(filesChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ file_type: 'mix' }),
    )
  })

  test('re-registering the same path reuses the row instead of duplicating it (#57)', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/put' },
      error: null,
    })
    const filesChain = createChainMock({
      data: { id: 'file-existing', file_type: 'mix' },
      error: null,
    })
    filesChain.maybeSingle.mockResolvedValue({
      data: { id: 'file-existing' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
      storageMocks: { 'project-uploads': { createSignedUploadUrl } },
    })

    const result = await createUpload(asClient(supabase), 'mix', ctx)

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Same row id: the Listen timeline and its comments stay attached.
      expect(result.row?.id).toBe('file-existing')
    }
    expect(filesChain.insert).not.toHaveBeenCalled()
    expect(filesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: 'kick.wav',
        file_size: 1024,
        upload_status: 'pending',
      }),
    )
    // file_type is never rewritten on reuse — a path belongs to one kind.
    expect(filesChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ file_type: expect.anything() }),
    )
  })

  test('stem: a storage collision fails before any row insert', async () => {
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'The resource already exists' },
    })
    const filesChain = createChainMock()
    const supabase = createSupabaseMock({
      fromMocks: { project_files: filesChain },
      storageMocks: { 'project-uploads': { createSignedUploadUrl } },
    })

    const result = await createUpload(asClient(supabase), 'stem', ctx)

    expect(result).toMatchObject({
      ok: false,
      status: 500,
      error: 'The resource already exists',
    })
    expect(filesChain.insert).not.toHaveBeenCalled()
    mockConsoleError.mockRestore()
  })

  test('comment_attachment: signs under a uuid without creating a row', async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/put' },
      error: null,
    })
    const supabase = createSupabaseMock({
      storageMocks: { 'project-uploads': { createSignedUploadUrl } },
    })

    const result = await createUpload(asClient(supabase), 'comment_attachment', {
      projectId: 'proj-1',
      ownerId: 'owner-1',
      fileName: 'note (1).pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.row).toBeUndefined()
      expect(result.storagePath).toMatch(
        /^owner-1\/proj-1\/comments\/[0-9a-f-]{36}\/note__1_\.pdf$/,
      )
    }
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('signedDownload / signedUrlFor / removeStorageObjects', () => {
  test('forces the stored file name as the download name', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    const supabase = createSupabaseMock({
      storageMocks: { 'project-uploads': { createSignedUrl } },
    })

    const result = await signedDownload(asClient(supabase), 'stem', {
      storage_path: 'o/p/kick.wav',
      file_name: 'kick.wav',
    })

    expect(result).toEqual({ url: 'https://example.com/signed' })
    expect(createSignedUrl).toHaveBeenCalledWith(
      'o/p/kick.wav',
      SIGNED_URL_TTL_SECONDS,
      { download: 'kick.wav' },
    )
  })

  test('signing failures surface as { error }', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    const supabase = createSupabaseMock({
      storageMocks: { 'project-uploads': { createSignedUrl } },
    })

    const result = await signedDownload(asClient(supabase), 'stem', {
      storage_path: 'o/p/kick.wav',
      file_name: 'kick.wav',
    })

    expect(result).toEqual({ error: 'boom' })
  })

  test('removeStorageObjects routes to the kind bucket and skips empty lists', async () => {
    const remove = vi.fn().mockResolvedValue({ data: null, error: null })
    const supabase = createSupabaseMock({
      storageMocks: { 'project-uploads': { remove } },
    })

    expect(
      await removeStorageObjects(asClient(supabase), 'stem', ['o/p/a.wav']),
    ).toEqual({ error: null })
    expect(remove).toHaveBeenCalledWith(['o/p/a.wav'])

    remove.mockClear()
    expect(await removeStorageObjects(asClient(supabase), 'stem', [])).toEqual({
      error: null,
    })
    expect(remove).not.toHaveBeenCalled()
  })
})

// The download choreography tests live here — once — instead of three
// near-identical route test files (#35): the route files re-export these
// exact handlers.
describe('download route handlers', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeParams(params: Record<string, string>) {
    return { params: Promise.resolve(params) }
  }

  function studioProfileChain() {
    return createChainMock({
      data: { id: 'studio-1', role: 'studio' },
      error: null,
    })
  }

  test('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue(createSupabaseMock({ user: null }))

    const res = await stemDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', fileId: 'f-1' }),
    )
    expect(res.status).toBe(401)
  })

  test('stems: 403 for clients before any project read (studio-only)', async () => {
    const profileChain = createChainMock({
      data: { id: 'user-1', role: 'client' },
      error: null,
    })
    const projectsChain = createChainMock()
    const supabase = createSupabaseMock({
      fromMocks: { profiles: profileChain, projects: projectsChain },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await stemDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', fileId: 'f-1' }),
    )
    expect(res.status).toBe(403)
    expect(projectsChain.select).not.toHaveBeenCalled()
  })

  test('returns 404 when the project is not visible', async () => {
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: studioProfileChain(),
        projects: createChainMock({ data: null, error: null }),
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await stemDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', fileId: 'f-1' }),
    )
    expect(res.status).toBe(404)
  })

  test('returns 404 with the kind message when the child row is missing', async () => {
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: studioProfileChain(),
        projects: createChainMock({
          data: { id: 'proj-1', owner_id: 'user-1' },
          error: null,
        }),
        project_comment_attachments: createChainMock({ data: null, error: null }),
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await attachmentDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', attachmentId: 'a-1' }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Attachment not found')
  })

  test('returns 500 when signed URL generation fails', async () => {
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: studioProfileChain(),
        projects: createChainMock({
          data: { id: 'proj-1', owner_id: 'user-1' },
          error: null,
        }),
        project_files: createChainMock({
          data: { storage_path: 'o/p/x.wav', file_name: 'x.wav' },
          error: null,
        }),
      },
      storageMocks: {
        'project-uploads': {
          createSignedUrl: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'boom' } }),
        },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await stemDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', fileId: 'f-1' }),
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })

  test('stems: 200 with a 1h signed URL forcing the file name', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    })
    const supabase = createSupabaseMock({
      fromMocks: {
        profiles: studioProfileChain(),
        projects: createChainMock({
          data: { id: 'proj-1', owner_id: 'user-1' },
          error: null,
        }),
        project_files: createChainMock({
          data: { storage_path: 'o/p/bass.wav', file_name: 'bass.wav' },
          error: null,
        }),
      },
      storageMocks: { 'project-uploads': { createSignedUrl } },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const res = await stemDownloadRoute(
      createMockRequest() as NextRequest,
      makeParams({ id: 'proj-1', fileId: 'f-1' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://example.com/signed')
    expect(createSignedUrl).toHaveBeenCalledWith('o/p/bass.wav', 3600, {
      download: 'bass.wav',
    })
  })

})
