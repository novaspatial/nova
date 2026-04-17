import clsx from 'clsx'
import type { SVGProps } from 'react'
import type { AudioPlayerAPI } from './types'

function LoopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 3L20 6L17 9" />
      <path d="M4 12V10C4 7.79086 5.79086 6 8 6H20" />
      <path d="M7 21L4 18L7 15" />
      <path d="M20 12V14C20 16.2091 18.2091 18 16 18H4" />
    </svg>
  )
}

export function LoopButton({ player }: { player: AudioPlayerAPI }) {
  return (
    <button
      type="button"
      className={clsx(
        'group relative rounded-md p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
        player.loop
          ? 'text-violet-400 hover:text-violet-300'
          : 'text-zinc-400 hover:text-white',
      )}
      onClick={() => player.toggleLoop()}
      aria-label="Loop track"
      aria-pressed={player.loop}
    >
      <div className="absolute -inset-2 md:hidden" />
      <LoopIcon className="size-5 stroke-current" />
    </button>
  )
}
