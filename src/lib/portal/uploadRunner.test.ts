import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUploadFile = vi.fn()
vi.mock('@/lib/portal/uploadFile', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}))

import { runUploadDance } from './uploadRunner'

const mockFetch = vi.fn()

function makeFile(name = 'kick.wav', type = 'audio/wav') {
  return new File(['data'], name, { type })
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  mockUploadFile.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runUploadDance', () => {
  test('stem: register → PUT → confirm, in order', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ fileId: 'f-1', uploadUrl: 'https://put' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'uploaded' }))
    const onUploaded = vi.fn()
    // The confirm must not fire before the PUT resolves.
    mockUploadFile.mockImplementation(async () => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    const result = await runUploadDance({
      projectId: 'proj-1',
      file: makeFile(),
      kind: 'stem',
      onUploaded,
    })

    expect(result).toEqual({ fileId: 'f-1' })
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/portal/projects/proj-1/files',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fileName: 'kick.wav',
          fileSize: 4,
          mimeType: 'audio/wav',
          fileType: 'stem',
        }),
      }),
    )
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'https://put',
      expect.any(Function),
    )
    expect(onUploaded).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/portal/projects/proj-1/files/f-1/confirm',
      { method: 'POST' },
    )
  })

  test('falls back to audio/x-wav when the browser gives no MIME type', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ fileId: 'f-1', uploadUrl: 'https://put' }))
      .mockResolvedValueOnce(jsonResponse({}))

    await runUploadDance({
      projectId: 'proj-1',
      file: makeFile('kick.wav', ''),
      kind: 'mix',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.mimeType).toBe('audio/x-wav')
    expect(body.fileType).toBe('mix')
  })

  test('surfaces the server message when register fails', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Payment required before uploading files' }, false),
    )

    await expect(
      runUploadDance({ projectId: 'proj-1', file: makeFile(), kind: 'stem' }),
    ).rejects.toThrow('Payment required before uploading files')
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  test('throws on a failed confirm', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ fileId: 'f-1', uploadUrl: 'https://put' }))
      .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })

    await expect(
      runUploadDance({ projectId: 'proj-1', file: makeFile(), kind: 'stem' }),
    ).rejects.toThrow('Failed to confirm upload')
  })

  test('propagates PUT failures without confirming', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ fileId: 'f-1', uploadUrl: 'https://put' }),
    )
    mockUploadFile.mockRejectedValue(new Error('Network error during upload'))
    const onUploaded = vi.fn()

    await expect(
      runUploadDance({
        projectId: 'proj-1',
        file: makeFile(),
        kind: 'stem',
        onUploaded,
      }),
    ).rejects.toThrow('Network error during upload')
    expect(onUploaded).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1) // no confirm
  })

  test('deliverable: single-phase register → PUT, no confirm', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ deliverableId: 'd-1', uploadUrl: 'https://put' }),
    )

    const result = await runUploadDance({
      projectId: 'proj-1',
      file: makeFile('master.wav'),
      kind: 'deliverable',
    })

    expect(result).toEqual({ deliverableId: 'd-1' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/portal/projects/proj-1/deliverables',
      expect.objectContaining({
        body: JSON.stringify({ fileName: 'master.wav', fileSize: 4 }),
      }),
    )
  })

  test('comment_attachment: returns the storage path for the later comment POST', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ storagePath: 'o/p/comments/u/note.pdf', uploadUrl: 'https://put' }),
    )
    const progress: number[] = []
    mockUploadFile.mockImplementation(
      async (_file, _url, onProgress: (pct: number) => void) => {
        onProgress(50)
        onProgress(100)
      },
    )

    const result = await runUploadDance({
      projectId: 'proj-1',
      file: makeFile('note.pdf', ''),
      kind: 'comment_attachment',
      onProgress: (pct) => progress.push(pct),
    })

    expect(result).toEqual({ storagePath: 'o/p/comments/u/note.pdf' })
    expect(progress).toEqual([50, 100])
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.mimeType).toBe('application/octet-stream')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/portal/projects/proj-1/comment-attachments/register',
      expect.anything(),
    )
  })
})
