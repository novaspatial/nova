'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import type { ProjectFile, ProjectStatus } from '@/types/portal'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowDownTrayIcon,
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

function useFileUpload(
  projectId: string,
  fileType: string,
  onUploadComplete?: () => void,
) {
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
    if (newFiles.length === 0) return false
    setUploading(true)
    const syncedFileIds: string[] = []

    for (const item of newFiles) {
      if (item.status !== 'pending') continue

      setNewFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'uploading' as const } : f,
        ),
      )

      try {
        const registerRes = await fetch(
          `/api/portal/projects/${projectId}/files`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.file.name,
              fileSize: item.file.size,
              mimeType: item.file.type || 'audio/wav',
              fileType,
            }),
          },
        )

        if (!registerRes.ok) {
          const errorData = await registerRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to register file')
        }

        const { fileId, uploadUrl } = await registerRes.json()

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
        syncedFileIds.push(item.id)
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

    if (syncedFileIds.length > 0) {
      setNewFiles((prev) => prev.filter((f) => !syncedFileIds.includes(f.id)))
    }

    setUploading(false)

    if (syncedFileIds.length > 0) {
      onUploadComplete?.()
    }

    return syncedFileIds.length > 0
  }, [newFiles, projectId, fileType, onUploadComplete])

  useEffect(() => {
    if (uploading) return
    if (!newFiles.some((file) => file.status === 'pending')) return

    void handleUploadAll()
  }, [newFiles, uploading, handleUploadAll])

  return { newFiles, uploading, handleFilesAdded, handleRemove, handleUploadAll }
}

function FileList({
  files,
  label,
  projectId,
  allowDownload = false,
}: {
  files: ProjectFile[]
  label: string
  projectId?: string
  allowDownload?: boolean
}) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(file: ProjectFile) {
    if (!projectId) return
    setDownloading(file.id)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/files/${file.id}/download`,
      )
      if (!res.ok) throw new Error('Failed to get download URL')
      const { url } = await res.json()
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloading(null)
    }
  }

  if (files.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-300">{label}</h3>
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-3 sm:gap-4 sm:px-4"
        >
          {file.file_type === 'mix' ? (
            <MusicalNoteIcon className="size-5 shrink-0 text-violet-400" />
          ) : (
            <DocumentIcon className="size-5 shrink-0 text-zinc-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">{file.file_name}</p>
            <p className="text-xs text-zinc-500">
              {formatFileSize(file.file_size)} &middot; {file.file_type}
            </p>
          </div>
          {allowDownload && file.upload_status === 'uploaded' ? (
            <button
              type="button"
              onClick={() => void handleDownload(file)}
              disabled={downloading === file.id}
              className="ml-auto shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-50"
              title={`Download ${file.file_name}`}
            >
              {downloading === file.id ? (
                <ArrowPathIcon className="size-4 animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="size-4" />
              )}
            </button>
          ) : (
            statusIcon[file.upload_status]
          )}
        </div>
      ))}
    </div>
  )
}

export function UploadManager({
  projectId,
  existingFiles,
  isReadOnly,
  isStudio = false,
  studioCanUploadMix = false,
  projectStatus,
}: {
  projectId: string
  existingFiles: ProjectFile[]
  isReadOnly: boolean
  isStudio?: boolean
  studioCanUploadMix?: boolean
  projectStatus: ProjectStatus
}) {
  const router = useRouter()
  const [settingStatus, setSettingStatus] = useState(false)
  const [finishingUpload, setFinishingUpload] = useState(false)
  const [clientActionError, setClientActionError] = useState<string | null>(null)
  const [studioActionError, setStudioActionError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<'finishUpload' | 'sendForReview' | null>(null)

  const refreshProject = useCallback(() => {
    router.refresh()
  }, [router])

  const clientUpload = useFileUpload(projectId, 'stem', refreshProject)
  const mixUpload = useFileUpload(projectId, 'mix', refreshProject)

  const stemFiles = existingFiles.filter((f) => f.file_type === 'stem' || f.file_type === 'master_ref')
  const mixFiles = existingFiles.filter((f) => f.file_type === 'mix')

  const handleSetStatus = async (
    status: string,
    onError: (message: string | null) => void,
  ) => {
    setSettingStatus(true)
    onError(null)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update project status.')
      }

      setActiveDialog(null)
      router.refresh()
      return true
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Network error while updating status.',
      )
      return false
    } finally {
      setSettingStatus(false)
    }
  }

  const handleFinishUpload = async () => {
    setFinishingUpload(true)
    setClientActionError(null)

    try {
      const res = await fetch(`/api/portal/projects/${projectId}/finish-upload`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit project. Please try again.')
      }

      setActiveDialog(null)
      router.refresh()
    } catch (error) {
      setClientActionError(
        error instanceof Error ? error.message : 'Network error while submitting.',
      )
    } finally {
      setFinishingUpload(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Client stems section */}
      <div className="space-y-4">
        <FileList
          files={stemFiles}
          label="Client Stems & References"
          projectId={projectId}
          allowDownload={isStudio}
        />

        {!isReadOnly && !isStudio && (
          <>
            <FileUploader
              files={clientUpload.newFiles}
              onFilesAdded={clientUpload.handleFilesAdded}
              onRemove={clientUpload.handleRemove}
              disabled={clientUpload.uploading}
            />
          </>
        )}

        {isReadOnly && !isStudio && stemFiles.length === 0 && (
          <p className="text-sm text-zinc-500">No files uploaded yet.</p>
        )}

        {/* Client finish upload */}
        {!isReadOnly && !isStudio && stemFiles.length > 0 && clientUpload.newFiles.length === 0 && (
          <div className="flex flex-col items-center border-t border-white/10 pt-4 text-center">
            <p className="mb-4 text-sm text-zinc-400">
              Once all your stems and references are uploaded, lock the project to begin the mixing process.
            </p>
            {clientActionError && (
              <p className="mb-4 w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {clientActionError}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setClientActionError(null)
                setActiveDialog('finishUpload')
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto sm:px-8"
            >
              Submit Files & Finish
            </button>
          </div>
        )}
      </div>

      {/* Studio mix upload section */}
      {isStudio && (
        <div className="space-y-4 border-t border-white/10 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-violet-300">
              Spatial Mixes
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Upload your Atmos and Binaural mixes for client review.
            </p>
          </div>

          <FileList files={mixFiles} label="Uploaded Mixes" />

          {studioCanUploadMix && (
            <>
              <FileUploader
                files={mixUpload.newFiles}
                onFilesAdded={mixUpload.handleFilesAdded}
                onRemove={mixUpload.handleRemove}
                disabled={mixUpload.uploading}
              />

              {/* Status transition buttons */}
              {mixFiles.length > 0 && mixUpload.newFiles.length === 0 && ['processing', 'mixing', 'revision'].includes(projectStatus) && (
                <div className="flex flex-wrap justify-center gap-3 pt-4">
                  {studioActionError && (
                    <p className="w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {studioActionError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStudioActionError(null)
                      setActiveDialog('sendForReview')
                    }}
                    disabled={settingStatus}
                    className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Send for Review
                  </button>
                </div>
              )}
            </>
          )}

          {!studioCanUploadMix && mixFiles.length === 0 && (
            <p className="text-sm text-zinc-500">
              {projectStatus === 'uploading'
                ? 'Waiting for client to finish uploading stems.'
                : 'Mixes will appear here once uploaded.'}
            </p>
          )}
        </div>
      )}

      <PortalConfirmDialog
        isOpen={activeDialog === 'finishUpload'}
        tone="success"
        eyebrow="Handoff"
        title="Submit files?"
        description="You will hand this project off to the studio."
        noteBody="Make sure every stem and reference you want included is already uploaded before continuing."
        confirmLabel="Submit Files & Finish"
        busyLabel="Submitting..."
        cancelLabel="Keep Uploading"
        isBusy={finishingUpload}
        errorMessage={clientActionError}
        onClose={() => {
          if (!finishingUpload) {
            setActiveDialog(null)
          }
        }}
        onConfirm={() => void handleFinishUpload()}
      />

      <PortalConfirmDialog
        isOpen={activeDialog === 'sendForReview'}
        tone="violet"
        eyebrow="Client review"
        title="Send mixes to the client?"
        description="This will move the project into review so the client can listen and leave timestamped feedback."
        noteTitle="Review becomes available right away."
        noteBody="Only send for review once the latest mix files are uploaded and ready for client feedback."
        confirmLabel="Send for Review"
        busyLabel="Sending..."
        cancelLabel="Not Yet"
        isBusy={settingStatus}
        errorMessage={studioActionError}
        onClose={() => {
          if (!settingStatus) {
            setActiveDialog(null)
          }
        }}
        onConfirm={() => void handleSetStatus('review', setStudioActionError)}
      />
    </div>
  )
}
