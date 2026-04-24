'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'

import { PortalConfirmDialog, ReviewTimeline } from '@/components/portal'
import type { ProjectComment, ProjectStatus, UserRole } from '@/types/portal'

import { ListenPlayer } from './ListenPlayer'

type Format = 'atmos' | 'binaural' | 'both'

type AudioFile = {
  id: string
  file_name: string
  mime_type: string
  signedUrl: string | null
  downloadUrl?: string | null
}

export function ListenView({
  projectId,
  format,
  status,
  audioFiles,
  initialComments,
  currentUserId,
  currentRole,
}: {
  projectId: string
  format: Format
  status: ProjectStatus
  audioFiles: AudioFile[]
  initialComments: ProjectComment[]
  currentUserId: string | null
  currentRole: UserRole | null
}) {
  const router = useRouter()
  const [comments, setComments] = useState<ProjectComment[]>(initialComments)
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [deliverError, setDeliverError] = useState<string | null>(null)

  const isStudio = currentRole === 'studio'
  const canDeliver = isStudio && status !== 'delivered'

  const handleDeliver = useCallback(async () => {
    setDelivering(true)
    setDeliverError(null)
    try {
      const res = await fetch(`/api/portal/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Failed to deliver project.')
      }
      setDeliverDialogOpen(false)
      router.refresh()
    } catch (error) {
      setDeliverError(
        error instanceof Error
          ? error.message
          : 'Network error while delivering the project.',
      )
    } finally {
      setDelivering(false)
    }
  }, [projectId, router])

  const firstPlayableTrackId = useMemo(
    () => audioFiles.find((file) => file.signedUrl)?.id ?? null,
    [audioFiles],
  )

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    firstPlayableTrackId,
  )

  // Keep optimistic, locally-created comments while syncing the server-refreshed
  // list back in after mutations trigger a router.refresh().
  useEffect(() => {
    setComments((current) => {
      const optimistic = current.filter(
        (entry) =>
          !initialComments.some((server) => server.id === entry.id),
      )
      return [...initialComments, ...optimistic]
    })
  }, [initialComments])

  // If the currently selected track disappears (deleted upstream) or was never
  // set, fall back to the first playable track.
  useEffect(() => {
    if (
      selectedTrackId &&
      audioFiles.some(
        (file) => file.id === selectedTrackId && file.signedUrl,
      )
    ) {
      return
    }
    setSelectedTrackId(firstPlayableTrackId)
  }, [audioFiles, firstPlayableTrackId, selectedTrackId])

  const commentCountByTrackId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const comment of comments) {
      counts[comment.track_id] = (counts[comment.track_id] ?? 0) + 1
    }
    return counts
  }, [comments])

  const visibleComments = useMemo(() => {
    if (!selectedTrackId) return []
    return comments.filter((comment) => comment.track_id === selectedTrackId)
  }, [comments, selectedTrackId])

  const selectedTrackName = useMemo(
    () =>
      audioFiles.find((file) => file.id === selectedTrackId)?.file_name ?? null,
    [audioFiles, selectedTrackId],
  )

  const handleSelectTrack = useCallback((trackId: string) => {
    setSelectedTrackId(trackId)
  }, [])

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Interactive Listening
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Experience your spatial mix with high-fidelity Binaural and Dolby
            Atmos playback.
          </p>
        </div>

        <ListenPlayer
          projectId={projectId}
          format={format}
          audioFiles={audioFiles}
          selectedTrackId={selectedTrackId}
          onSelectTrack={handleSelectTrack}
          commentCountByTrackId={commentCountByTrackId}
        />
      </div>

      <ReviewTimeline
        projectId={projectId}
        comments={visibleComments}
        onCommentsChange={setComments}
        selectedTrackId={selectedTrackId}
        selectedTrackName={selectedTrackName}
        currentUserId={currentUserId}
        currentRole={currentRole}
      />

      {canDeliver && (
        <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-emerald-300">
            Ready to deliver?
          </p>
          <p className="mt-1 text-sm text-emerald-300/60">
            Finalize this project and notify the client that their mix has been
            delivered.
          </p>
          {deliverError && (
            <p className="mt-3 w-full rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {deliverError}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setDeliverError(null)
              setDeliverDialogOpen(true)
            }}
            disabled={delivering}
            className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/80 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 backdrop-blur-sm transition hover:bg-emerald-500/90 hover:shadow-emerald-500/35 disabled:opacity-50"
          >
            Deliver
          </button>
        </div>
      )}

      <PortalConfirmDialog
        isOpen={deliverDialogOpen}
        tone="success"
        eyebrow="Deliver"
        title="Deliver this project?"
        description="This will mark the project as delivered and email the client that their mix is ready."
        noteTitle="Delivery is the final step."
        noteBody="Make sure any outstanding revisions are resolved before delivering."
        confirmLabel="Deliver"
        busyLabel="Delivering..."
        cancelLabel="Not Yet"
        isBusy={delivering}
        errorMessage={deliverError}
        onClose={() => {
          if (!delivering) {
            setDeliverDialogOpen(false)
          }
        }}
        onConfirm={() => void handleDeliver()}
      />
    </div>
  )
}
