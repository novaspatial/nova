'use client'

import Image from 'next/image'
import { XMarkIcon } from '@heroicons/react/24/outline'

import { ForwardButton } from '@/components/audio/player/ForwardButton'
import { LoopButton } from '@/components/audio/player/LoopButton'
import { MuteButton } from '@/components/audio/player/MuteButton'
import { NextButton } from '@/components/audio/player/NextButton'
import { PlayButton } from '@/components/audio/player/PlayButton'
import { PreviousButton } from '@/components/audio/player/PreviousButton'
import { RewindButton } from '@/components/audio/player/RewindButton'
import { useWaveformBinding } from '@/components/audio/player/useWaveformBinding'
import { formatTrackTime, Waveform } from '@/components/audio/player/Waveform'

export function AudioPlayer() {
  const { player, waveformProps, elapsedSeconds, hasDuration } =
    useWaveformBinding()

  if (!player.mixedMusicFile) {
    return null
  }

  return (
    <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
      <div className="mx-auto rounded-xl bg-zinc-900/95 shadow-lg ring-1 shadow-violet-500/5 ring-white/10 backdrop-blur-sm">
        {/* Mobile waveform row */}
        <div className="flex items-center gap-2 px-6 pt-3 md:hidden">
          <span
            className={`w-10 text-right font-mono text-[0.6875rem] text-zinc-500 tabular-nums ${
              hasDuration ? '' : 'opacity-0'
            }`}
          >
            {formatTrackTime(elapsedSeconds, player.duration)}
          </span>
          <Waveform {...waveformProps} />
          <span
            className={`w-10 text-left font-mono text-[0.6875rem] text-zinc-500 tabular-nums ${
              hasDuration ? '' : 'opacity-0'
            }`}
          >
            {formatTrackTime(player.duration, player.duration)}
          </span>
        </div>

        {/* Main player bar */}
        <div className="flex items-center gap-4 px-5 py-3.5 md:gap-8 md:px-8">
          {/* Track info */}
          <div className="flex min-w-0 shrink-0 items-center gap-3 md:max-w-[16rem]">
            <div
              className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-violet-500/30 to-violet-900/40 ring-1 ring-white/10 ring-inset"
              aria-hidden="true"
            >
              <Image
                src="/favicon.ico"
                alt=""
                width={32}
                height={32}
                className="size-7 object-contain"
                unoptimized
              />
            </div>
            <div className="hidden min-w-0 flex-col md:flex">
              <span
                className="truncate text-sm font-medium text-white"
                title={player.mixedMusicFile.title}
              >
                {player.mixedMusicFile.title}
              </span>
            </div>
          </div>

          {/* Transport cluster */}
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <RewindButton player={player} />
            <PreviousButton player={player} />
            <PlayButton player={player} />
            <NextButton player={player} />
            <ForwardButton player={player} />
            <LoopButton player={player} />
          </div>

          {/* Time + Waveform + Time */}
          <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
            <span
              className={`w-12 text-right font-mono text-xs text-zinc-500 tabular-nums ${
                hasDuration ? '' : 'opacity-0'
              }`}
              aria-live="off"
            >
              {formatTrackTime(elapsedSeconds, player.duration)}
            </span>
            <Waveform {...waveformProps} />
            <span
              className={`w-12 text-left font-mono text-xs text-zinc-500 tabular-nums ${
                hasDuration ? '' : 'opacity-0'
              }`}
            >
              {formatTrackTime(player.duration, player.duration)}
            </span>
          </div>

          {/* Utility cluster */}
          <div className="flex shrink-0 items-center gap-1 md:gap-2">
            <MuteButton player={player} />
            <button
              type="button"
              onClick={() => player.clear()}
              aria-label="Close audio player"
              className="group relative ml-1 rounded-md p-0.5 text-zinc-600 transition hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              <XMarkIcon className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
