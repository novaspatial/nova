// Raw XHR PUT so we get `upload.onprogress` events (fetch doesn't expose
// upload progress yet). Retries, aborts, and timeouts are the caller's
// responsibility — on unmount the XHR is garbage-collected and the request
// is implicitly cancelled.
export function uploadFile(
  file: File,
  uploadUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        const body = xhr.responseText?.trim() ?? ''
        console.error('[uploadFile] storage PUT failed', {
          status: xhr.status,
          body,
        })
        const detail = body ? ` — ${body}` : ''
        reject(new Error(`Upload failed with status ${xhr.status}${detail}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })
}
