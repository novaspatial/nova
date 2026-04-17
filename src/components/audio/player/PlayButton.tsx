import { PauseIcon } from '@/components/audio/PauseIcon'
import { PlayIcon } from '@/components/audio/PlayIcon'
import type { AudioPlayerAPI } from './types'

export function PlayButton({ player }: { player: AudioPlayerAPI }) {
  const Icon = player.playing ? PauseIcon : PlayIcon

  return (
    <button
      type="button"
      className="group relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-violet-500/20 hover:text-violet-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
      onClick={() => player.toggle()}
      aria-label={player.playing ? 'Pause' : 'Play'}
    >
      <div className="absolute -inset-2 md:hidden" />
      <Icon className="size-4 fill-current" />
    </button>
  )
}
