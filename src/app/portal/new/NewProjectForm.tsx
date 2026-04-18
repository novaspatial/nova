'use client'

import { useState, useCallback } from 'react'
import { FileUploader } from '@/components/portal'
import type { FileUploadItem } from '@/types/portal'
import { uploadFile } from '@/lib/portal/uploadFile'

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 sm:text-sm'

function findDuplicateFileNames(items: FileUploadItem[]): string[] {
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const item of items) {
    const name = item.file.name
    if (seen.has(name)) dups.add(name)
    else seen.add(name)
  }
  return Array.from(dups)
}

export function NewProjectForm() {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const items: FileUploadItem[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...items])
  }, [])

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim()) {
        setError('Project title is required.')
        return
      }
      if (files.length === 0) {
        setError('Please add at least one file.')
        return
      }

      const duplicates = findDuplicateFileNames(files)
      if (duplicates.length > 0) {
        setError(
          `Duplicate file names: ${duplicates.join(', ')}. Remove duplicates before submitting.`,
        )
        return
      }

      setSubmitting(true)
      setError(null)

      let createdProjectId: string | null = null
      // Best-effort cleanup so a partial failure doesn't leave an orphan
      // "uploading" project row on the dashboard.
      const rollbackProject = async () => {
        if (!createdProjectId) return
        try {
          await fetch(`/api/portal/projects/${createdProjectId}`, {
            method: 'DELETE',
          })
        } catch (rollbackErr) {
          console.error('[NewProjectForm] project rollback failed', rollbackErr)
        }
        createdProjectId = null
        // Reset file state so the next submit re-uploads every file to the
        // freshly-created project (the previous storage objects were cascaded
        // away by the project delete).
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'pending' as const,
            progress: 0,
            error: undefined,
          })),
        )
      }

      try {
        // 1. Create project
        const projectRes = await fetch('/api/portal/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            format: 'atmos',
            notes: notes.trim() || null,
          }),
        })

        if (!projectRes.ok) {
          const data = await projectRes.json() as { error?: string }
          throw new Error(data.error || 'Failed to create project')
        }

        const { id: projectId } = await projectRes.json() as { id: string }
        createdProjectId = projectId

        // 2. Upload each file (continue on per-file errors, collect failures)
        // NOTE: keep this loop's skip/state logic in sync with
        // src/hooks/useFileUpload.ts — the two paths intentionally stay separate.
        let failureCount = 0

        for (const item of files) {
          // Skip items that already finished in a prior submit attempt so retries
          // only re-upload what actually failed.
          if (item.status === 'uploaded' || item.status === 'synced') {
            continue
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: 'uploading' as const } : f,
            ),
          )

          try {
            // Register file
            const registerRes = await fetch(
              `/api/portal/projects/${projectId}/files`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: item.file.name,
                  fileSize: item.file.size,
                  mimeType: item.file.type || 'audio/x-wav',
                  fileType: 'stem',
                }),
              },
            )

            if (!registerRes.ok) {
              const data = await registerRes.json().catch(() => ({})) as { error?: string }
              throw new Error(data.error || 'Failed to register file')
            }
            const { fileId, uploadUrl } = await registerRes.json() as { fileId: string; uploadUrl: string }

            // Upload to storage
            await uploadFile(item.file, uploadUrl, (progress) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id ? { ...f, progress } : f,
                ),
              )
            })

            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'uploaded' as const, progress: 100 }
                  : f,
              ),
            )

            // Confirm & sync
            const confirmRes = await fetch(
              `/api/portal/projects/${projectId}/files/${fileId}/confirm`,
              { method: 'POST' },
            )

            if (!confirmRes.ok) {
              throw new Error('Failed to confirm file upload')
            }

            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, status: 'synced' as const } : f,
              ),
            )
          } catch (fileErr) {
            failureCount++
            const message =
              fileErr instanceof Error ? fileErr.message : 'Upload failed'
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'failed' as const, error: message, progress: 0 }
                  : f,
              ),
            )
          }
        }

        if (failureCount > 0) {
          await rollbackProject()
          setError(
            `${failureCount} file${failureCount > 1 ? 's' : ''} failed to upload. The draft project was discarded — please try again.`,
          )
          setSubmitting(false)
          return
        }

        // Force a fresh document navigation after the initial upload flow so
        // the new project page renders with the latest server data immediately.
        window.location.assign(`/portal/${projectId}/upload`)
      } catch (err) {
        await rollbackProject()
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setSubmitting(false)
      }
    },
    [title, notes, files],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 sm:text-sm">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Project Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Album Name — Dolby Atmos Mix"
          className={`mt-2 ${inputClassName}`}
          disabled={submitting}
        />
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Project Notes{' '}
          <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any references, preferences, or instructions for the mix engineer..."
          rows={4}
          className={`mt-2 resize-none ${inputClassName}`}
          disabled={submitting}
        />
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-xs font-medium text-zinc-300 sm:text-sm">
          Upload Files
        </label>
        <div className="mt-2">
          <FileUploader
            files={files}
            onFilesAdded={handleFilesAdded}
            onRemove={handleRemove}
            disabled={submitting}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-violet-600 px-6 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
      >
        {submitting ? 'Creating Project & Uploading...' : 'Create Project & Upload'}
      </button>
    </form>
  )
}
