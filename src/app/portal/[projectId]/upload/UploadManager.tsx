'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'
import type { ProjectFile, ProjectStatus } from '@/types/portal'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentIcon,
  MusicalNoteIcon,
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

function useFileUpload(projectId: string, fileType: string) {
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
  }, [newFiles, projectId, fileType])

  return { newFiles, uploading, handleFilesAdded, handleRemove, handleUploadAll }
}

function FileList({ files, label }: { files: ProjectFile[]; label: string }) {
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
          {statusIcon[file.upload_status]}
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

  const clientUpload = useFileUpload(projectId, 'stem')
  const mixUpload = useFileUpload(projectId, 'mix')

  const stemFiles = existingFiles.filter((f) => f.file_type === 'stem' || f.file_type === 'master_ref')
  const mixFiles = existingFiles.filter((f) => f.file_type === 'mix')

  const handleSetStatus = async (status: string) => {
    setSettingStatus(true)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to update project status.')
      }
    } catch {
      alert('Network error while updating status.')
    } finally {
      setSettingStatus(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Client stems section */}
      <div className="space-y-4">
        <FileList files={stemFiles} label="Client Stems & References" />

        {!isReadOnly && !isStudio && (
          <>
            <FileUploader
              files={clientUpload.newFiles}
              onFilesAdded={clientUpload.handleFilesAdded}
              onRemove={clientUpload.handleRemove}
              disabled={clientUpload.uploading}
            />

            {clientUpload.newFiles.some((f) => f.status === 'pending') && (
              <button
                onClick={clientUpload.handleUploadAll}
                disabled={clientUpload.uploading}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
              >
                {clientUpload.uploading ? 'Uploading...' : 'Upload All Files'}
              </button>
            )}
          </>
        )}

        {isReadOnly && !isStudio && stemFiles.length === 0 && (
          <p className="text-sm text-zinc-500">No files uploaded yet.</p>
        )}

        {/* Client finish upload */}
        {!isReadOnly && !isStudio && stemFiles.length > 0 && clientUpload.newFiles.length === 0 && (
          <div className="border-t border-white/10 pt-4">
            <p className="mb-4 text-sm text-zinc-400">
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
                  } catch {
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

              {mixUpload.newFiles.some((f) => f.status === 'pending') && (
                <button
                  onClick={mixUpload.handleUploadAll}
                  disabled={mixUpload.uploading}
                  className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {mixUpload.uploading ? 'Uploading Mixes...' : 'Upload Mixes'}
                </button>
              )}

              {/* Status transition buttons */}
              {mixFiles.length > 0 && mixUpload.newFiles.length === 0 && (
                <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                  {projectStatus === 'processing' && (
                    <button
                      onClick={() => handleSetStatus('mixing')}
                      disabled={settingStatus}
                      className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                    >
                      Mark as Mixing
                    </button>
                  )}
                  {['processing', 'mixing', 'revision'].includes(projectStatus) && (
                    <button
                      onClick={() => {
                        if (confirm('Send mixes to the client for review?')) {
                          handleSetStatus('review')
                        }
                      }}
                      disabled={settingStatus}
                      className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Send for Review
                    </button>
                  )}
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
    </div>
  )
}
