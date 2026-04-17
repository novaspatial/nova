import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadFile } from './uploadFile'

interface MockXhr {
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null }
  onload: (() => void) | null
  onerror: (() => void) | null
  status: number
  open: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

let xhr: MockXhr

describe('uploadFile', () => {
  beforeEach(() => {
    xhr = {
      upload: { onprogress: null },
      onload: null,
      onerror: null,
      status: 200,
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
    }
    const captured = xhr
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        upload = captured.upload
        get onload() { return captured.onload }
        set onload(v) { captured.onload = v }
        get onerror() { return captured.onerror }
        set onerror(v) { captured.onerror = v }
        get status() { return captured.status }
        set status(v) { captured.status = v }
        open = captured.open
        setRequestHeader = captured.setRequestHeader
        send = captured.send
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves on 2xx status', async () => {
    xhr.status = 201
    const p = uploadFile(new File(['a'], 'f.wav'), 'https://example.com/up', vi.fn())
    xhr.onload!()
    await expect(p).resolves.toBeUndefined()
  })

  it('rejects on non-2xx status with the status code', async () => {
    xhr.status = 403
    const p = uploadFile(new File(['a'], 'f.wav'), 'https://example.com/up', vi.fn())
    xhr.onload!()
    await expect(p).rejects.toThrow('Upload failed with status 403')
  })

  it('rejects on network error', async () => {
    const p = uploadFile(new File(['a'], 'f.wav'), 'https://example.com/up', vi.fn())
    xhr.onerror!()
    await expect(p).rejects.toThrow('Network error during upload')
  })

  it('calls onProgress with the computed percentage', async () => {
    const onProgress = vi.fn()
    const p = uploadFile(new File(['a'], 'f.wav'), 'https://example.com/up', onProgress)

    xhr.upload.onprogress!({ lengthComputable: true, loaded: 25, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(25)

    xhr.upload.onprogress!({ lengthComputable: true, loaded: 100, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(100)

    xhr.onload!()
    await p
  })

  it('skips onProgress when length is not computable', async () => {
    const onProgress = vi.fn()
    const p = uploadFile(new File(['a'], 'f.wav'), 'https://example.com/up', onProgress)

    xhr.upload.onprogress!({ lengthComputable: false, loaded: 50, total: 100 })
    expect(onProgress).not.toHaveBeenCalled()

    xhr.onload!()
    await p
  })

  it('opens a PUT request to the given URL', async () => {
    const url = 'https://storage.example.com/object/key'
    const p = uploadFile(new File(['a'], 'f.wav'), url, vi.fn())
    xhr.onload!()
    await p
    expect(xhr.open).toHaveBeenCalledWith('PUT', url)
  })

  it('sets Content-Type from the file MIME type', async () => {
    const file = new File(['a'], 'f.wav', { type: 'audio/wav' })
    const p = uploadFile(file, 'https://example.com/up', vi.fn())
    xhr.onload!()
    await p
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'audio/wav')
  })

  it('falls back to application/octet-stream when file has no MIME type', async () => {
    const file = new File(['a'], 'f.bin')
    const p = uploadFile(file, 'https://example.com/up', vi.fn())
    xhr.onload!()
    await p
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream')
  })

  it('sends the file as the request body', async () => {
    const file = new File(['payload'], 'f.wav', { type: 'audio/wav' })
    const p = uploadFile(file, 'https://example.com/up', vi.fn())
    xhr.onload!()
    await p
    expect(xhr.send).toHaveBeenCalledWith(file)
  })
})
