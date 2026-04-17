import type { SVGProps } from 'react'
import type { AudioPlayerAPI } from './types'

function NextIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M18 6V18" />
      <path d="M5 5.5V18.5C5 19.2928 5.89341 19.7571 6.54232 19.3018L15.8284 12.8017C16.3905 12.4082 16.3905 11.5918 15.8284 11.1983L6.54232 4.69823C5.89341 4.24285 5 4.70719 5 5.5Z" />
    </svg>
  )
}

export function NextButton({ player }: { player: AudioPlayerAPI }) {
  const disabled = player.duration === 0

  return (
    <button
      type="button"
      className="group relative rounded-md p-1 text-zinc-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:hover:text-zinc-400"
      onClick={() => player.seek(player.duration)}
      aria-label="Skip to end"
      disabled={disabled}
    >
      <div className="absolute -inset-2 md:hidden" />
      <NextIcon className="size-5 stroke-current" />
    </button>
  )
}
