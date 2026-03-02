'use client'

import { useMemo } from 'react'
import {
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

import {
  useAudioPlayer,
  type MixedMusicFile,
} from '@/components/audio/AudioProvider'

type Format = 'atmos' | 'binaural' | 'both'

type AudioFile = {
  id: string
  file_name: string
  mime_type: string
  signedUrl: string | null
}

function FileRow({
  file,
  isActive,
}: {
  file: AudioFile
  isActive: boolean
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

  return (
    <button
      onClick={() => player.toggle()}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition',
        isActive
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
    </button>
  )
}

export function ListenPlayer({
  format,
  audioFiles,
}: {
  projectId: string
  format: Format
  audioFiles: AudioFile[]
}) {
  const player = useAudioPlayer()
  const playableFiles = audioFiles.filter((f) => f.signedUrl)

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
          Formats available:{' '}
          <span className="text-zinc-300">Dolby Atmos</span> and{' '}
          <span className="text-zinc-300">Binaural</span>
        </p>
      )}

      {/* File list */}
      <div className="space-y-1 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Tracks
        </p>
        {playableFiles.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            isActive={player.mixedMusicFile?.id === file.id}
          />
        ))}
      </div>

      {player.mixedMusicFile && (
        <p className="text-xs text-zinc-500">
          Now playing:{' '}
          <span className="text-zinc-300">{player.mixedMusicFile.title}</span>
        </p>
      )}
    </div>
  )
}
