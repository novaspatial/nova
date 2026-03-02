'use client'

import { useCallback, useState } from 'react'
import type { Deliverable, ProjectStatus } from '@/types/portal'
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
  const [approving, setApproving] = useState(false)

  const handleApprove = useCallback(async () => {
    setApproving(true)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (!res.ok) throw new Error('Failed to approve')
      window.location.reload()
    } catch {
      // Could add error toast
    } finally {
      setApproving(false)
    }
  }, [projectId])

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
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
          <div>
            <p className="text-sm font-medium text-amber-300">
              Ready to approve?
            </p>
            <p className="mt-0.5 text-xs text-amber-300/60">
              Approving will make deliverables available to the client.
            </p>
          </div>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? 'Approving...' : 'Mark Approved'}
          </button>
        </div>
      )}

      {/* Deliverables list */}
      {deliverables.length > 0 ? (
        <div className="space-y-3">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              projectId={projectId}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center backdrop-blur-sm">
          <p className="text-sm text-zinc-400">
            {isStudio
              ? 'No deliverables uploaded yet. Upload final masters for the client.'
              : 'No deliverables available yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
