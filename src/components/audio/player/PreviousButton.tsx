import type { SVGProps } from 'react'
import type { AudioPlayerAPI } from './types'

function PreviousIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6 6V18" />
      <path d="M19 5.5V18.5C19 19.2928 18.1066 19.7571 17.4577 19.3018L8.17157 12.8017C7.60952 12.4082 7.60952 11.5918 8.17157 11.1983L17.4577 4.69823C18.1066 4.24285 19 4.70719 19 5.5Z" />
    </svg>
  )
}

export function PreviousButton({ player }: { player: AudioPlayerAPI }) {
  const disabled = !player.hasPrevious

  return (
    <button
      type="button"
      className="group relative rounded-md p-1 text-zinc-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:hover:text-zinc-400"
      onClick={() => player.previous()}
      aria-label="Previous track"
      disabled={disabled}
    >
      <div className="absolute -inset-2 md:hidden" />
      <PreviousIcon className="size-5 stroke-current" />
    </button>
  )
}
