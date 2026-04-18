'use client'

import { useState, useCallback, useEffect } from 'react'
import type { FileType, FileUploadItem } from '@/types/portal'
import { uploadFile } from '@/lib/portal/uploadFile'

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

    // NOTE: keep this loop's skip/state logic in sync with the handleSubmit loop
    // in src/app/portal/new/NewProjectForm.tsx — the two paths intentionally
    // stay separate (one uploads to an existing project, the other creates one
    // and rolls back on failure), but drift between them has caused bugs.
    for (const item of files) {
      if (item.status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading' as const } : f)),
      )

      try {
        if (fileType === 'deliverable') {
          const registerRes = await fetch(
            `/api/portal/projects/${projectId}/deliverables`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: item.file.name, fileSize: item.file.size }),
            },
          )
          if (!registerRes.ok) {
            const data = await registerRes.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to register deliverable')
          }
          const { uploadUrl } = await registerRes.json()

          await uploadFile(item.file, uploadUrl, (progress) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress } : f)),
            )
          })

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: 'synced' as const, progress: 100 } : f,
            ),
          )
        } else {
          const registerRes = await fetch(
            `/api/portal/projects/${projectId}/files`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.file.name,
                fileSize: item.file.size,
                mimeType: item.file.type || 'audio/x-wav',
                fileType,
              }),
            },
          )
          if (!registerRes.ok) {
            const data = await registerRes.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to register file')
          }
          const { fileId, uploadUrl } = await registerRes.json()

          await uploadFile(item.file, uploadUrl, (progress) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress } : f)),
            )
          })

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: 'uploaded' as const, progress: 100 } : f,
            ),
          )

          const confirmRes = await fetch(
            `/api/portal/projects/${projectId}/files/${fileId}/confirm`,
            { method: 'POST' },
          )
          if (!confirmRes.ok) throw new Error('Failed to confirm upload')

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: 'synced' as const } : f,
            ),
          )
        }

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
