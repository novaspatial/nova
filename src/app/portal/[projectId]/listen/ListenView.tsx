'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  useAudioPlayer,
  type MixedMusicFile,
} from '@/components/audio/AudioProvider'
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

  const player = useAudioPlayer()
  const queueFiles = useMemo<MixedMusicFile[]>(
    () =>
      audioFiles
        .filter((file) => file.signedUrl)
        .map((file) => ({
          id: file.id,
          title: file.file_name,
          audio: { src: file.signedUrl! },
        })),
    [audioFiles],
  )

  useEffect(() => {
    player.setQueue(queueFiles)
    return () => {
      player.setQueue([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueFiles])

  const playingTrackId = player.mixedMusicFile?.id ?? null
  useEffect(() => {
    if (playingTrackId == null) return
    const id = String(playingTrackId)
    if (id === selectedTrackId) return
    if (audioFiles.some((file) => file.id === id)) {
      setSelectedTrackId(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingTrackId])

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
