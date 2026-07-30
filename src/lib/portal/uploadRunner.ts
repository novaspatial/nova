// The client half of the signed-URL upload choreography, extracted
// from the three components that used to hand-copy it (useFileUpload,
// NewProjectForm, ReviewTimeline). One dance per file:
//
//   stem/master_ref/mix   register → PUT → confirm   (two-phase)
//   comment_attachment    register → PUT             (row created later by
//                                                     the listen POST)
//
// Callers keep their own queue/rollback/preview state machines and observe
// progress via callbacks; this module owns only the wire protocol.

import { uploadFile } from '@/lib/portal/uploadFile'

export type UploadDanceKind =
  | 'stem'
  | 'master_ref'
  | 'mix'
  | 'comment_attachment'

export type UploadDanceResult = {
  fileId?: string
  storagePath?: string
}

export type UploadDanceOptions = {
  projectId: string
  file: File
  kind: UploadDanceKind
  onProgress?: (percent: number) => void
  /** Fires after the storage PUT succeeds, before any confirm step. */
  onUploaded?: () => void
}

async function register(
  url: string,
  payload: Record<string, unknown>,
  failureMessage: string,
): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || failureMessage)
  }
  return res.json()
}

/**
 * Runs the full register → PUT (→ confirm) dance for one file. Throws an
 * Error carrying the server's message on any failed step.
 */
export async function runUploadDance({
  projectId,
  file,
  kind,
  onProgress,
  onUploaded,
}: UploadDanceOptions): Promise<UploadDanceResult> {
  const base = `/api/portal/projects/${projectId}`
  const noop = () => {}
  const reportProgress = onProgress ?? noop

  if (kind === 'comment_attachment') {
    const { storagePath, uploadUrl } = await register(
      `${base}/comment-attachments/register`,
      {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      },
      'Failed to register attachment',
    )

    await uploadFile(file, uploadUrl, reportProgress)
    onUploaded?.()

    return { storagePath }
  }

  const { fileId, uploadUrl } = await register(
    `${base}/files`,
    {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'audio/x-wav',
      fileType: kind,
    },
    'Failed to register file',
  )

  await uploadFile(file, uploadUrl, reportProgress)
  onUploaded?.()

  const confirmRes = await fetch(`${base}/files/${fileId}/confirm`, {
    method: 'POST',
  })
  if (!confirmRes.ok) {
    throw new Error('Failed to confirm upload')
  }

  return { fileId }
}
