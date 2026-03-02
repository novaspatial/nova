import { PauseIcon } from '@/components/audio/PauseIcon'
import { PlayIcon } from '@/components/audio/PlayIcon'
import type { AudioPlayerAPI } from './types'

export function PlayButton({ player }: { player: AudioPlayerAPI }) {
  const Icon = player.playing ? PauseIcon : PlayIcon

  return (
    <button
      type="button"
      className="group relative flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900 md:size-14"
      onClick={() => player.toggle()}
      aria-label={player.playing ? 'Pause' : 'Play'}
    >
      <div className="absolute -inset-3 md:hidden" />
      <Icon className="size-5 fill-white group-active:fill-white/80 md:size-7" />
    </button>
  )
}
