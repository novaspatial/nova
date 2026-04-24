'use client'

import { useEffect, useMemo } from 'react'
import {
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

import {
  useAudioPlayer,
  type MixedMusicFile,
} from '@/components/audio/AudioProvider'
import { prefetchWaveformPeaks } from '@/components/audio/player/Waveform'

type Format = 'atmos' | 'binaural' | 'both'

type AudioFile = {
  id: string
  file_name: string
  mime_type: string
  signedUrl: string | null
  downloadUrl?: string | null
}

function FileRow({
  file,
  isSelected,
  commentCount,
  onSelect,
}: {
  file: AudioFile
  isSelected: boolean
  commentCount: number
  onSelect: () => void
}) {
  const mixedMusicFile: MixedMusicFile = useMemo(
    () => ({
      id: file.id,
      title: file.file_name,
      audio: { src: file.signedUrl! },
    }),
    [file.id, file.file_name, file.signedUrl],
  )

  const player = useAudioPlayer(mixedMusicFile)
  const commentCountLabel =
    commentCount === 1 ? '1 comment' : `${commentCount} comments`

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          onSelect()
          player.toggle()
        }}
        aria-pressed={isSelected}
        className={clsx(
          'flex w-full flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition',
          isSelected
            ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
            : 'text-zinc-400 hover:bg-white/5 hover:text-white',
        )}
      >
        {player.playing ? (
          <PauseIcon className="size-4 shrink-0" />
        ) : (
          <PlayIcon className="size-4 shrink-0" />
        )}
        <span className="truncate">{file.file_name}</span>
        {commentCount > 0 && (
          <span
            aria-label={commentCountLabel}
            className={clsx(
              'ml-auto inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
              isSelected
                ? 'bg-violet-500/20 text-violet-200'
                : 'bg-white/5 text-zinc-400',
            )}
          >
            {commentCount}
          </span>
        )}
      </button>
      {file.downloadUrl && (
        <a
          href={file.downloadUrl}
          aria-label={`Download ${file.file_name}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-violet-500/40 hover:text-violet-300 focus:outline-none focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/50"
        >
          <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

export function ListenPlayer({
  format,
  audioFiles,
  selectedTrackId,
  onSelectTrack,
  commentCountByTrackId,
}: {
  projectId: string
  format: Format
  audioFiles: AudioFile[]
  selectedTrackId: string | null
  onSelectTrack: (trackId: string) => void
  commentCountByTrackId: Record<string, number>
}) {
  const player = useAudioPlayer()
  const playableFiles = audioFiles.filter((f) => f.signedUrl)
  const prefetchKey = playableFiles.map((f) => f.signedUrl).join('|')

  useEffect(() => {
    for (const file of playableFiles) {
      prefetchWaveformPeaks(file.signedUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey])

  if (playableFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/2 px-6 py-16 text-center backdrop-blur-sm">
        <MusicalNoteIcon className="size-12 text-zinc-600" />
        <p className="mt-4 text-base text-zinc-400">
          Your spatial mix is being prepared.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          The studio will make the player available once your mix is ready for
          review.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Format indicator */}
      {format === 'both' && (
        <p className="text-xs text-zinc-500">
          Formats available: <span className="text-zinc-300">Dolby Atmos</span>{' '}
          and <span className="text-zinc-300">Binaural</span>
        </p>
      )}

      {/* File list */}
      <div
        data-listen-tracks
        className="space-y-1 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm"
      >
        <p className="mb-3 text-xs font-medium tracking-wider text-zinc-500 uppercase">
          Tracks
        </p>
        {playableFiles.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isSelected={selectedTrackId === file.id}
            commentCount={commentCountByTrackId[file.id] ?? 0}
            onSelect={() => onSelectTrack(file.id)}
          />
        ))}
      </div>

    </div>
  )
}
