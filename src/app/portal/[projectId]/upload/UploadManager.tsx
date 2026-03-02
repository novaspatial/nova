'use client'

import { useState, useCallback } from 'react'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'
import type { ProjectFile } from '@/types/portal'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const statusIcon: Record<string, React.ReactNode> = {
  synced: <CheckCircleIcon className="size-5 text-emerald-400" />,
  failed: <ExclamationCircleIcon className="size-5 text-red-400" />,
  syncing: <ArrowPathIcon className="size-5 animate-spin text-violet-400" />,
  uploading: <ArrowPathIcon className="size-5 animate-spin text-blue-400" />,
  uploaded: <CheckCircleIcon className="size-5 text-blue-400" />,
  pending: <DocumentIcon className="size-5 text-zinc-500" />,
}

export function UploadManager({
  projectId,
  existingFiles,
  isReadOnly,
}: {
  projectId: string
  existingFiles: ProjectFile[]
  isReadOnly: boolean
}) {
  const [newFiles, setNewFiles] = useState<FileUploadItem[]>([])
  const [uploading, setUploading] = useState(false)

  const handleFilesAdded = useCallback((files: File[]) => {
    const items: FileUploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }))
    setNewFiles((prev) => [...prev, ...items])
  }, [])

  const handleRemove = useCallback((id: string) => {
    setNewFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleUploadAll = useCallback(async () => {
    if (newFiles.length === 0) return
    setUploading(true)

    for (const item of newFiles) {
      if (item.status !== 'pending') continue

      setNewFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'uploading' as const } : f,
        ),
      )

      try {
        // 1. Register file with API to get signed upload URL
        const registerRes = await fetch(
          `/api/portal/projects/${projectId}/files`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.file.name,
              fileSize: item.file.size,
              mimeType: item.file.type || 'audio/wav',
              fileType: 'stem',
            }),
          },
        )

        if (!registerRes.ok) {
          const errorData = await registerRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to register file')
        }

        const { fileId, uploadUrl } = await registerRes.json()

        // 2. Upload to Supabase Storage via signed URL with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100)
              setNewFiles((prev) =>
                prev.map((f) => (f.id === item.id ? { ...f, progress } : f)),
              )
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`))
            }
          }
          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', item.file.type || 'audio/wav')
          xhr.send(item.file)
        })

        setNewFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'uploaded' as const, progress: 100 }
              : f,
          ),
        )

        // 3. Confirm upload and trigger Samply sync
        const confirmRes = await fetch(
          `/api/portal/projects/${projectId}/files/${fileId}/confirm`,
          { method: 'POST' },
        )

        if (!confirmRes.ok) {
          throw new Error('Failed to confirm upload')
        }

        setNewFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'synced' as const } : f,
          ),
        )
      } catch (err) {
        setNewFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'failed' as const,
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : f,
          ),
        )
      }
    }

    setUploading(false)
  }, [newFiles, projectId])

  return (
    <div className="space-y-6">
      {/* Existing uploaded files */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Uploaded Files</h3>
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-3 sm:gap-4 sm:px-4"
            >
              <DocumentIcon className="size-5 shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{file.file_name}</p>
                <p className="text-xs text-zinc-500">
                  {formatFileSize(file.file_size)} &middot; {file.file_type}
                </p>
              </div>
              {statusIcon[file.upload_status]}
            </div>
          ))}
        </div>
      )}

      {/* New file uploads */}
      {!isReadOnly && (
        <>
          <FileUploader
            files={newFiles}
            onFilesAdded={handleFilesAdded}
            onRemove={handleRemove}
            disabled={uploading}
          />

          {newFiles.some((f) => f.status === 'pending') && (
            <button
              onClick={handleUploadAll}
              disabled={uploading}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {uploading ? 'Uploading...' : 'Upload All Files'}
            </button>
          )}
        </>
      )}

      {isReadOnly && existingFiles.length === 0 && (
        <p className="text-sm text-zinc-500">No files uploaded yet.</p>
      )}

      {/* Finish Uploading */}
      {!isReadOnly && existingFiles.length > 0 && newFiles.length === 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-sm text-zinc-400 mb-4">
            Once all your stems and references are uploaded, lock the project to begin the mixing process.
          </p>
          <button
            onClick={async () => {
              if (confirm('Are you ready to submit your files? You will not be able to upload more files after this.')) {
                try {
                  const res = await fetch(`/api/portal/projects/${projectId}/finish-upload`, {
                    method: 'POST',
                  })
                  if (res.ok) {
                    window.location.reload()
                  } else {
                    alert('Failed to submit project. Please try again.')
                  }
                } catch (err) {
                  alert('Network error while submitting.')
                }
              }
            }}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto sm:px-8"
          >
            Submit Files & Finish
          </button>
        </div>
      )}
    </div>
  )
}
