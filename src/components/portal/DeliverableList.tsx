'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { FileUploader, type FileUploadItem } from '@/components/portal/FileUploader'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import type { Deliverable, DeliverableFormat, ProjectStatus } from '@/types/portal'
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  DocumentArrowDownIcon,
  TrashIcon,
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
  isStudio,
  isDelivered,
  onDeleted,
}: {
  deliverable: Deliverable
  projectId: string
  isStudio: boolean
  isDelivered: boolean
  onDeleted?: (id: string) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/deliverables/${deliverable.id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Failed to delete deliverable')
      onDeleted?.(deliverable.id)
    } catch {
      // Could add error toast
    } finally {
      setDeleting(false)
    }
  }, [projectId, deliverable.id, onDeleted])

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
      {isStudio ? (
        <button
          onClick={() => void handleDelete()}
          disabled={deleting || isDelivered}
          title={isDelivered ? 'Cannot delete after delivery' : 'Delete deliverable'}
          className="group flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:border-white/10 disabled:hover:bg-white/5 disabled:hover:text-zinc-500"
        >
          <TrashIcon className="size-4 transition-transform group-hover:scale-110" />
        </button>
      ) : (
        <button
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          <ArrowDownTrayIcon className="size-4" />
          <span className="hidden sm:inline">
            {downloading ? 'Loading...' : 'Download'}
          </span>
        </button>
      )}
    </div>
  )
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-zinc-900/95 px-4 py-3.5 shadow-xl shadow-black/40 backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
        <ExclamationTriangleIcon className="size-4 text-amber-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Format required</p>
        <p className="mt-0.5 text-xs text-zinc-400">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  )
}

function StudioDeliverableUploader({
  projectId,
  format,
  onFormatChange,
  formatHighlight,
  flashFormatHighlight,
}: {
  projectId: string
  format: DeliverableFormat | null
  onFormatChange: (f: DeliverableFormat) => void
  formatHighlight: boolean
  flashFormatHighlight: () => void
}) {
  const router = useRouter()
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMessage(msg)
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

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
    if (!format) {
      showToast('Please select a deliverable format before uploading.')
      return
    }
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
  }, [files, projectId, format, router, showToast])

  useEffect(() => {
    if (uploading) return
    if (!files.some((f) => f.status === 'pending')) return
    if (!format) {
      flashFormatHighlight()
      return
    }
    void handleUploadAll()
  }, [files, uploading, format, handleUploadAll, flashFormatHighlight])

  return (
    <>
    {toastMessage && (
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    )}
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-zinc-400">
          Deliverable Format
        </label>
        <div className={`inline-flex rounded-xl border bg-white/5 p-1 backdrop-blur-sm transition-colors duration-300 ${formatHighlight ? 'border-rose-500/50' : 'border-white/10'}`}>
          {formatOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={uploading}
              onClick={() => onFormatChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                format === opt.value
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <FileUploader
        files={files}
        onFilesAdded={handleFilesAdded}
        onRemove={handleRemove}
        disabled={uploading}
      />
    </div>
    </>
  )
}

export function DeliverableList({
  projectId,
  deliverables: initialDeliverables,
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
  const [deliverables, setDeliverables] = useState(initialDeliverables)
  const [approving, setApproving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<'approved' | null>(null)
  const [format, setFormat] = useState<DeliverableFormat | null>(null)
  const [formatHighlight, setFormatHighlight] = useState(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashFormatHighlight = useCallback(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setFormatHighlight(true)
    highlightTimer.current = setTimeout(() => setFormatHighlight(false), 1500)
  }, [])

  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])

  const handleDeleted = useCallback((id: string) => {
    setDeliverables((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleSetStatus = useCallback(async (status: string) => {
    setApproving(true)
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
      setApproving(false)
    }
  }, [projectId, router])

  useEffect(() => {
    if (isStudio && projectStatus === 'approved' && deliverables.length > 0) {
      void handleSetStatus('delivered')
    }
  }, [isStudio, projectStatus, deliverables.length, handleSetStatus])

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
      {/* Deliverables list */}
      {deliverables.length > 0 && (
        <div className="space-y-3">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              projectId={projectId}
              isStudio={isStudio}
              isDelivered={projectStatus === 'delivered'}
              onDeleted={handleDeleted}
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
          <StudioDeliverableUploader
            projectId={projectId}
            format={format}
            onFormatChange={(f) => {
              setFormat(f)
              if (highlightTimer.current) clearTimeout(highlightTimer.current)
              setFormatHighlight(false)
            }}
            formatHighlight={formatHighlight}
            flashFormatHighlight={flashFormatHighlight}
          />
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

      {/* Studio approval banner */}
      {isStudio && !isApproved && (
        <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Ready to approve?
              </p>
              <p className="mt-0.5 text-xs text-emerald-300/60">
                Approving will make deliverables available to the client.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!format) {
                  flashFormatHighlight()
                  return
                }
                setStatusError(null)
                setActiveDialog('approved')
              }}
              disabled={approving || deliverables.length === 0}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
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

    </div>
  )
}
