'use client'

import { useState, useCallback } from 'react'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50'

export function NewProjectForm() {
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<'atmos' | 'binaural' | 'both'>('atmos')
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

      setSubmitting(true)
      setError(null)

      try {
        // 1. Create project
        const projectRes = await fetch('/api/portal/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            format,
            notes: notes.trim() || null,
          }),
        })

        if (!projectRes.ok) {
          const data = await projectRes.json()
          throw new Error(data.error || 'Failed to create project')
        }

        const { id: projectId } = await projectRes.json()

        // 2. Upload each file (continue on per-file errors, collect failures)
        let failureCount = 0

        for (const item of files) {
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
                  mimeType: item.file.type || 'audio/wav',
                  fileType: 'stem',
                }),
              },
            )

            if (!registerRes.ok) {
              const data = await registerRes.json().catch(() => ({}))
              throw new Error(data.error || 'Failed to register file')
            }
            const { fileId, uploadUrl } = await registerRes.json()

            // Upload to storage
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const progress = Math.round((e.loaded / e.total) * 100)
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === item.id ? { ...f, progress } : f,
                    ),
                  )
                }
              }
              xhr.onload = () =>
                xhr.status >= 200 && xhr.status < 300
                  ? resolve()
                  : reject(new Error(`Upload failed with status ${xhr.status}`))
              xhr.onerror = () => reject(new Error('Network error during upload'))
              xhr.open('PUT', uploadUrl)
              xhr.setRequestHeader(
                'Content-Type',
                item.file.type || 'audio/wav',
              )
              xhr.send(item.file)
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
          setError(
            `${failureCount} file${failureCount > 1 ? 's' : ''} failed to upload. Check the list above and try again.`,
          )
          setSubmitting(false)
          return
        }

        // Force a fresh document navigation after the initial upload flow so
        // the new project page renders with the latest server data immediately.
        window.location.assign(`/portal/${projectId}/upload`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setSubmitting(false)
      }
    },
    [title, format, notes, files],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-300"
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

      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-zinc-300">
          Target Format
        </label>
        <div className="mt-2 flex gap-2">
          {(
            [
              { value: 'atmos', label: 'Dolby Atmos' },
              { value: 'binaural', label: 'Binaural' },
              { value: 'both', label: 'Both' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormat(option.value)}
              disabled={submitting}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                format === option.value
                  ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                  : 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-300"
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
        <label className="block text-sm font-medium text-zinc-300">
          Upload Files
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Multitrack stems and stereo master reference
        </p>
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
        className="w-full rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Creating Project & Uploading...' : 'Create Project & Upload'}
      </button>
    </form>
  )
}
