'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import type { Deliverable, DeliverableFormat, ProjectStatus } from '@/types/portal'
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatLabels: Record<string, string> = {
  adm_bwf: 'ADM BWF',
  binaural_wav: 'Binaural WAV',
  dolby_atmos_adm: 'Dolby Atmos ADM',
}

const formatOptions: { value: DeliverableFormat; label: string }[] = [
  { value: 'adm_bwf', label: 'ADM BWF' },
  { value: 'binaural_wav', label: 'Binaural WAV' },
  { value: 'dolby_atmos_adm', label: 'Dolby Atmos ADM' },
]

function DeliverableCard({
  deliverable,
  projectId,
}: {
  deliverable: Deliverable
  projectId: string
}) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/deliverables/${deliverable.id}/download`,
      )
      if (!res.ok) throw new Error('Failed to get download URL')
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch {
      // Could add error toast
    } finally {
      setDownloading(false)
    }
  }, [projectId, deliverable.id])

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 sm:size-12">
        <DocumentArrowDownIcon className="size-5 text-emerald-400 sm:size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white sm:text-base">
          {deliverable.file_name}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
            {formatLabels[deliverable.format] || deliverable.format}
          </span>
          <span className="text-xs text-zinc-500">
            {formatFileSize(deliverable.file_size)}
          </span>
          {deliverable.approved_at && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckBadgeIcon className="size-3.5" />
              Approved
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
      >
        <ArrowDownTrayIcon className="size-4" />
        <span className="hidden sm:inline">
          {downloading ? 'Loading...' : 'Download'}
        </span>
      </button>
    </div>
  )
}

function StudioDeliverableUploader({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [format, setFormat] = useState<DeliverableFormat>('adm_bwf')

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

  const handleUploadAll = useCallback(async () => {
    if (files.length === 0) return
    setUploading(true)
    const syncedFileIds: string[] = []

    for (const item of files) {
      if (item.status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'uploading' as const } : f,
        ),
      )

      try {
        // 1. Register deliverable and get signed upload URL
        const registerRes = await fetch(
          `/api/portal/projects/${projectId}/deliverables`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.file.name,
              fileSize: item.file.size,
              format,
            }),
          },
        )

        if (!registerRes.ok) {
          const errorData = await registerRes.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to register deliverable')
        }

        const { uploadUrl } = await registerRes.json()

        // 2. Upload file to storage
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100)
              setFiles((prev) =>
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
          xhr.setRequestHeader(
            'Content-Type',
            item.file.type || 'application/octet-stream',
          )
          xhr.send(item.file)
        })

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'synced' as const, progress: 100 }
              : f,
          ),
        )
        syncedFileIds.push(item.id)
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

    if (syncedFileIds.length > 0) {
      setFiles((prev) => prev.filter((f) => !syncedFileIds.includes(f.id)))
    }

    setUploading(false)
    router.refresh()
  }, [files, projectId, format, router])

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-zinc-400">
          Deliverable Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as DeliverableFormat)}
          disabled={uploading}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
        >
          {formatOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <FileUploader
        files={files}
        onFilesAdded={handleFilesAdded}
        onRemove={handleRemove}
        disabled={uploading}
      />

      {files.some((f) => f.status === 'pending') && (
        <button
          type="button"
          onClick={handleUploadAll}
          disabled={uploading}
          className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {uploading ? 'Uploading...' : 'Upload Deliverables'}
        </button>
      )}
    </div>
  )
}

export function DeliverableList({
  projectId,
  deliverables,
  isStudio,
  isApproved,
  projectStatus,
}: {
  projectId: string
  deliverables: Deliverable[]
  isStudio: boolean
  isApproved: boolean
  projectStatus: ProjectStatus
}) {
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<'approved' | 'delivered' | null>(null)

  const handleSetStatus = useCallback(async (status: string) => {
    const setter = status === 'approved' ? setApproving : setDelivering
    setter(true)
    setStatusError(null)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to set status to ${status}`)
      }

      setActiveDialog(null)
      router.refresh()
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : `Failed to set status to ${status}`,
      )
    } finally {
      setter(false)
    }
  }, [projectId, router])

  if (!isApproved && !isStudio) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/2 px-6 py-16 text-center backdrop-blur-sm">
        <ArrowDownTrayIcon className="size-12 text-zinc-600" />
        <p className="mt-4 text-base text-zinc-400">
          Your deliverables will appear here once your mix is approved.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Current status:{' '}
          <span className="text-zinc-300">{projectStatus}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Studio approval banner */}
      {isStudio && !isApproved && (
        <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-300">
                Ready to approve?
              </p>
              <p className="mt-0.5 text-xs text-amber-300/60">
                Approving will make deliverables available to the client.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusError(null)
                setActiveDialog('approved')
              }}
              disabled={approving}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {approving ? 'Approving...' : 'Mark Approved'}
            </button>
          </div>
          {statusError && (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {statusError}
            </p>
          )}
        </div>
      )}

      {/* Studio finalize delivery banner */}
      {isStudio && projectStatus === 'approved' && deliverables.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Finalize delivery?
              </p>
              <p className="mt-0.5 text-xs text-emerald-300/60">
                Mark this project as delivered to complete the workflow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusError(null)
                setActiveDialog('delivered')
              }}
              disabled={delivering}
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {delivering ? 'Delivering...' : 'Mark Delivered'}
            </button>
          </div>
          {statusError && (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {statusError}
            </p>
          )}
        </div>
      )}

      {/* Deliverables list */}
      {deliverables.length > 0 && (
        <div className="space-y-3">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {/* Studio upload section */}
      {isStudio && !isApproved && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-violet-300">
              Upload Deliverables
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Upload final master files for the client to download.
            </p>
          </div>
          <StudioDeliverableUploader projectId={projectId} />
        </div>
      )}

      {/* Empty state */}
      {deliverables.length === 0 && !(isStudio && !isApproved) && (
        <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center backdrop-blur-sm">
          <p className="text-sm text-zinc-400">
            No deliverables available yet.
          </p>
        </div>
      )}

      <PortalConfirmDialog
        isOpen={activeDialog === 'approved'}
        tone="success"
        eyebrow="Client release"
        title="Approve these deliverables?"
        description="The client will be able to access the deliver page and start downloading the approved masters right away."
        noteTitle="Approval opens delivery access."
        noteBody="Confirm this once the files are final and ready for the client to receive."
        confirmLabel="Mark Approved"
        busyLabel="Approving..."
        cancelLabel="Review Again"
        isBusy={approving}
        errorMessage={statusError}
        onClose={() => {
          if (!approving) {
            setActiveDialog(null)
          }
        }}
        onConfirm={() => void handleSetStatus('approved')}
      />

      <PortalConfirmDialog
        isOpen={activeDialog === 'delivered'}
        tone="violet"
        eyebrow="Workflow completion"
        title="Mark this project as delivered?"
        description="This finalizes the project workflow and signals that the approved deliverables have been handed off."
        noteTitle="Use this once delivery is complete."
        noteBody="The project will move into its delivered state immediately after confirmation."
        confirmLabel="Mark Delivered"
        busyLabel="Delivering..."
        cancelLabel="Not Yet"
        isBusy={delivering}
        errorMessage={statusError}
        onClose={() => {
          if (!delivering) {
            setActiveDialog(null)
          }
        }}
        onConfirm={() => void handleSetStatus('delivered')}
      />
    </div>
  )
}
