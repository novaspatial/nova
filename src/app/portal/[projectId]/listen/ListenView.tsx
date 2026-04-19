'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReviewTimeline } from '@/components/portal'
import type { ProjectComment, UserRole } from '@/types/portal'

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
  audioFiles,
  initialComments,
  currentUserId,
  currentRole,
}: {
  projectId: string
  format: Format
  audioFiles: AudioFile[]
  initialComments: ProjectComment[]
  currentUserId: string | null
  currentRole: UserRole | null
}) {
  const [comments, setComments] = useState<ProjectComment[]>(initialComments)

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
      if (comment.parent_id) continue
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
    </div>
  )
}
