'use client'

// Post-creation upload surface: attached to an existing project, stem files
// go through useFileUpload's two-phase flow (register → PUT → confirm) and
// mix files (studio-only) use the same route with `fileType: 'mix'`. The
// pre-creation flow in NewProjectForm keeps its own queue state but shares
// the per-file wire choreography via runUploadDance.

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploader } from '@/components/portal/FileUploader'
import { useProject } from '@/components/portal/ProjectContext'
import { useFileUpload } from '@/hooks/useFileUpload'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import {
  usePortalToast,
  type PortalToastInput,
} from '@/components/portal/PortalToast'
import { formatFileSize } from '@/lib/formatFileSize'
import {
  canonicalStatus,
  canTransition,
  canUploadMix,
} from '@/lib/portal/workflow'
import type { ProjectFile, ProjectStatus } from '@/types/portal'
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

const statusIcon: Record<string, React.ReactNode> = {
  synced: <CheckCircleIcon className="size-5 text-emerald-400" />,
  failed: <ExclamationCircleIcon className="size-5 text-red-400" />,
  syncing: <ArrowPathIcon className="size-5 animate-spin text-violet-400" />,
  uploading: <ArrowPathIcon className="size-5 animate-spin text-blue-400" />,
  uploaded: <CheckCircleIcon className="size-5 text-blue-400" />,
  pending: <DocumentIcon className="size-5 text-zinc-500" />,
}


function FileList({
  files,
  label,
  projectId,
  allowDownload = false,
  onDeleted,
}: {
  files: ProjectFile[]
  label: string
  projectId?: string
  allowDownload?: boolean
  onDeleted?: (id: string) => void
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDownload(file: ProjectFile) {
    if (!projectId) return
    setDownloading(file.id)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/files/${file.id}/download`,
      )
      if (!res.ok) throw new Error('Failed to get download URL')
      const { url } = await res.json() as { url: string }
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

  async function handleDelete(file: ProjectFile) {
    if (!projectId) return
    setDeleting(file.id)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/files/${file.id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Failed to delete file')
      onDeleted?.(file.id)
    } catch {
      // Could add error toast
    } finally {
      setDeleting(null)
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {allowDownload && file.upload_status === 'uploaded' && (
              <button
                type="button"
                onClick={() => void handleDownload(file)}
                disabled={downloading === file.id}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-50"
                title={`Download ${file.file_name}`}
              >
                {downloading === file.id ? (
                  <ArrowPathIcon className="size-4 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="size-4" />
                )}
              </button>
            )}
            {onDeleted ? (
              <button
                type="button"
                onClick={() => void handleDelete(file)}
                disabled={deleting === file.id}
                title={`Delete ${file.file_name}`}
                className="group rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-20"
              >
                {deleting === file.id ? (
                  <ArrowPathIcon className="size-4 animate-spin" />
                ) : (
                  <TrashIcon className="size-4 transition-transform group-hover:scale-110" />
                )}
              </button>
            ) : (
              !allowDownload && statusIcon[file.upload_status]
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function UploadManager({
  existingFiles: initialFiles,
  isReadOnly,
}: {
  existingFiles: ProjectFile[]
  isReadOnly: boolean
}) {
  const { projectId, isStudio, projectStatus, userRole } = useProject()
  const router = useRouter()
  const showToast = usePortalToast()
  const [files, setFiles] = useState(initialFiles)
  const [currentStatus, setCurrentStatus] = useState(projectStatus)
  const [settingStatus, setSettingStatus] = useState(false)
  const [finishingUpload, setFinishingUpload] = useState(false)
  const [clientActionError, setClientActionError] = useState<string | null>(null)
  const [studioActionError, setStudioActionError] = useState<string | null>(null)
  const [activeDialog, setActiveDialog] = useState<'finishUpload' | 'approveProject' | 'sendForReview' | null>(null)

  const handleDeleted = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const refreshProject = useCallback(() => {
    router.refresh()
  }, [router])

  // Finishing a mix upload is not the same event as the client receiving it:
  // while mixing, files sit on the project unseen; once the project is in
  // review/revision the client's Listen tab is already open, so a fresh upload
  // is visible to them the moment it lands. Say which one just happened.
  const handleMixUploaded = useCallback(() => {
    showToast({
      tone: 'violet',
      title: 'Mix upload complete',
      body:
        canonicalStatus(currentStatus) === 'mixing'
          ? 'Saved to the project. The client cannot hear it until you press Send for Review.'
          : 'This project is already in review, so the file is on the client’s Listen tab now.',
    })
    refreshProject()
  }, [currentStatus, refreshProject, showToast])

  const clientUpload = useFileUpload({ projectId, fileType: 'stem', onComplete: refreshProject })
  const mixUpload = useFileUpload({ projectId, fileType: 'mix', onComplete: handleMixUploaded })

  const stemFiles = files.filter((f) => f.file_type === 'stem' || f.file_type === 'master_ref')
  const mixFiles = files.filter((f) => f.file_type === 'mix')

  const handleSetStatus = async (
    status: string,
    onError: (message: string | null) => void,
    notice?: PortalToastInput,
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
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || 'Failed to update project status.')
      }

      setCurrentStatus(status as ProjectStatus)
      setActiveDialog(null)
      if (notice) showToast(notice)
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
        const data = await res.json().catch(() => ({})) as { error?: string }
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
          label="Client Uploads"
          projectId={projectId}
          allowDownload={isStudio}
          onDeleted={isStudio || !isReadOnly ? handleDeleted : undefined}
        />

        {!isReadOnly && !isStudio && (
          <>
            <FileUploader
              files={clientUpload.files}
              onFilesAdded={clientUpload.addFiles}
              onRemove={clientUpload.removeFile}
              disabled={clientUpload.uploading}
            />
          </>
        )}

        {isReadOnly && !isStudio && stemFiles.length === 0 && (
          <p className="text-sm text-zinc-500">No files uploaded yet.</p>
        )}

        {/* Client finish upload */}
        {!isReadOnly && !isStudio && stemFiles.length > 0 && clientUpload.files.length === 0 && (
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
              Upload Mixes
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Upload your spatial mixes for client review.
            </p>
          </div>

          {canTransition(currentStatus, 'mixing', userRole) && (
            <div className="flex flex-col items-center rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-5 text-center backdrop-blur-sm">
              <p className="text-sm font-semibold text-blue-300">
                New project awaiting approval
              </p>
              <p className="mt-1 text-sm text-blue-300/60">
                Review the client&apos;s uploaded stems and approve to begin mixing.
              </p>
              {studioActionError && (
                <p className="mt-3 w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {studioActionError}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setStudioActionError(null)
                  setActiveDialog('approveProject')
                }}
                disabled={settingStatus}
                className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 backdrop-blur-sm transition hover:bg-emerald-500/90 hover:shadow-emerald-500/35 disabled:opacity-50"
              >
                Approve &amp; Start Mixing
              </button>
            </div>
          )}

          {/* The toast that fires on Send for Review is gone by the next
              visit; this is the standing answer to "did these go out?" —
              derived from status, so it stays true after any refresh. */}
          {mixFiles.length > 0 &&
            (canonicalStatus(currentStatus) === 'review' ||
              canonicalStatus(currentStatus) === 'revision') && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 backdrop-blur-sm">
                <PaperAirplaneIcon className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Sent to the client
                  </p>
                  <p className="mt-1 text-sm text-emerald-300/60">
                    {canonicalStatus(currentStatus) === 'review'
                      ? 'The client can play these mixes on their Listen tab. Anything you upload here now appears for them right away.'
                      : 'The client has these mixes and asked for revisions. Upload a new mix, then send it for review again so they can take a listen.'}
                  </p>
                </div>
              </div>
            )}

          <FileList
            files={mixFiles}
            label="Uploaded Mixes"
            projectId={projectId}
            onDeleted={handleDeleted}
          />

          {canUploadMix(currentStatus) && (
            <>
              <FileUploader
                files={mixUpload.files}
                onFilesAdded={mixUpload.addFiles}
                onRemove={mixUpload.removeFile}
                disabled={mixUpload.uploading}
              />

              {/* Status transition buttons */}
              {mixFiles.length > 0 && mixUpload.files.length === 0 && canTransition(currentStatus, 'review', userRole) && (
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

          {!canUploadMix(currentStatus) && currentStatus !== 'in_review' && mixFiles.length === 0 && (
            <p className="text-sm text-zinc-500">
              {currentStatus === 'uploading'
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
        isOpen={activeDialog === 'approveProject'}
        tone="violet"
        eyebrow="Approve"
        title="Start mixing this project?"
        description="This will move the project to In Progress and notify the client that work has begun."
        noteTitle="The client will see the status change."
        noteBody="Make sure you have reviewed the uploaded stems before approving."
        confirmLabel="Approve & Start Mixing"
        busyLabel="Approving..."
        cancelLabel="Not Yet"
        isBusy={settingStatus}
        errorMessage={studioActionError}
        onClose={() => {
          if (!settingStatus) {
            setActiveDialog(null)
          }
        }}
        onConfirm={() =>
          void handleSetStatus('mixing', setStudioActionError, {
            tone: 'violet',
            title: 'Project approved',
            body: 'Mixing has started — the client can see the new status, and a notification email should be on its way.',
          })
        }
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
        onConfirm={() =>
          void handleSetStatus('review', setStudioActionError, {
            tone: 'success',
            title: 'Mixes sent to the client',
            body: `${mixFiles.length} mix ${mixFiles.length === 1 ? 'file is' : 'files are'} now on the client’s Listen tab, and a notification email should be on its way.`,
          })
        }
      />
    </div>
  )
}
