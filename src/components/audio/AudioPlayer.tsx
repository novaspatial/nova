'use client'

import { useEffect, useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

import { useAudioPlayer } from '@/components/audio/AudioProvider'
import { ForwardButton } from '@/components/audio/player/ForwardButton'
import { MuteButton } from '@/components/audio/player/MuteButton'
import { PlayButton } from '@/components/audio/player/PlayButton'
import { RewindButton } from '@/components/audio/player/RewindButton'
import { Slider, formatHumanTime } from '@/components/audio/player/Slider'

export function AudioPlayer() {
  const player = useAudioPlayer()

  const wasPlayingRef = useRef(false)
  const [currentTime, setCurrentTime] = useState<number | null>(
    player.currentTime,
  )

  useEffect(() => {
    setCurrentTime(null)
  }, [player.currentTime])

  if (!player.mixedMusicFile) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-6 bg-zinc-900/95 px-4 py-4 shadow-lg shadow-violet-500/5 ring-1 ring-white/10 backdrop-blur-sm md:px-6">
      <div className="hidden md:block">
        <PlayButton player={player} />
      </div>
      <div className="mb-[env(safe-area-inset-bottom)] flex min-w-0 flex-1 flex-col gap-3 p-1">
        <span
          className="truncate text-center text-sm/6 font-bold text-white md:text-left"
          title={player.mixedMusicFile.title}
        >
          {player.mixedMusicFile.title}
        </span>
        <div className="flex justify-between gap-6">
          <div className="flex items-center md:hidden">
            <MuteButton player={player} />
          </div>
          <div className="flex flex-none items-center gap-4">
            <RewindButton player={player} />
            <div className="md:hidden">
              <PlayButton player={player} />
            </div>
            <ForwardButton player={player} />
          </div>
          <Slider
            label="Current time"
            maxValue={player.duration}
            step={1}
            value={[currentTime ?? player.currentTime]}
            onChange={([value]) => setCurrentTime(value)}
            onChangeEnd={([value]) => {
              player.seek(value)
              if (wasPlayingRef.current) {
                player.play()
              }
            }}
            numberFormatter={{ format: formatHumanTime }}
            onChangeStart={() => {
              wasPlayingRef.current = player.playing
              player.pause()
            }}
          />
          <div className="flex items-center gap-4">
            <div className="hidden items-center md:flex">
              <MuteButton player={player} />
            </div>
            <button
              type="button"
              onClick={() => player.clear()}
              aria-label="Close audio player"
              className="inline-flex size-11 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <XMarkIcon className="size-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
