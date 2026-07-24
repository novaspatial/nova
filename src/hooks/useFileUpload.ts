'use client'

// Auto-uploading upload queue for an existing project. Adds are idempotent:
// each item goes through `pending → uploading → (uploaded →) synced` once
// and is then dropped from the list by `onComplete`. The per-file wire
// choreography lives in `runUploadDance`; this hook owns only the queue
// state. There is no abort controller — XHRs are implicitly cancelled when
// the component unmounts, and failures leave the item in `failed` state for
// the user to retry or remove.

import { useState, useCallback, useEffect } from 'react'
import type { FileType, FileUploadItem } from '@/types/portal'
import { runUploadDance } from '@/lib/portal/uploadRunner'

export interface UseFileUploadOptions {
  projectId: string
  fileType: FileType
  onComplete?: () => void
}

export interface UseFileUploadResult {
  files: FileUploadItem[]
  uploading: boolean
  addFiles: (newFiles: File[]) => void
  removeFile: (id: string) => void
  clearCompleted: () => void
}

export function useFileUpload({
  projectId,
  fileType,
  onComplete,
}: UseFileUploadOptions): UseFileUploadResult {
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [uploading, setUploading] = useState(false)

  const addFiles = useCallback((newFiles: File[]) => {
    const items: FileUploadItem[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...items])
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'synced'))
  }, [])

  const runUpload = useCallback(async () => {
    if (files.length === 0) return
    setUploading(true)
    const syncedIds: string[] = []

    for (const item of files) {
      if (item.status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading' as const } : f)),
      )

      try {
        await runUploadDance({
          projectId,
          file: item.file,
          kind: fileType,
          onProgress: (progress) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress } : f)),
            )
          },
          onUploaded: () => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'uploaded' as const, progress: 100 }
                  : f,
              ),
            )
          },
        })

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'synced' as const, progress: 100 }
              : f,
          ),
        )

        syncedIds.push(item.id)
      } catch (err) {
        setFiles((prev) =>
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

    if (syncedIds.length > 0) {
      setFiles((prev) => prev.filter((f) => !syncedIds.includes(f.id)))
      onComplete?.()
    }

    setUploading(false)
  }, [files, projectId, fileType, onComplete])

  useEffect(() => {
    if (uploading) return
    if (!files.some((f) => f.status === 'pending')) return
    void runUpload()
  }, [files, uploading, runUpload])

  return { files, uploading, addFiles, removeFile, clearCompleted }
}
