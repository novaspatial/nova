import { useEffect, useRef, useState, type SVGProps } from 'react'
import type { AudioPlayerAPI } from './types'

function VolumeIcon({
  volume,
  ...props
}: SVGProps<SVGSVGElement> & { volume: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 6L8 10H6C5.44772 10 5 10.4477 5 11V13C5 13.5523 5.44772 14 6 14H8L12 18V6Z" />
      {volume === 0 ? (
        <>
          <path d="M16 10L19 13" fill="none" />
          <path d="M19 10L16 13" fill="none" />
        </>
      ) : volume < 0.5 ? (
        <path
          d="M15.5 10.5C15.5 10.5 16 10.9998 16 11.9999C16 13 15.5 13.5 15.5 13.5"
          fill="none"
        />
      ) : (
        <>
          <path d="M17 7C17 7 19 9 19 12C19 15 17 17 17 17" fill="none" />
          <path
            d="M15.5 10.5C15.5 10.5 16 10.9998 16 11.9999C16 13 15.5 13.5 15.5 13.5"
            fill="none"
          />
        </>
      )}
    </svg>
  )
}

export function MuteButton({ player }: { player: AudioPlayerAPI }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const volumePercent = Math.round(player.volume * 100)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={wrapperRef} className="relative md:order-first">
      <button
        type="button"
        className="group relative rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Adjust volume"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <div className="absolute -inset-4 md:hidden" />
        <VolumeIcon
          volume={player.volume}
          className="size-8 fill-zinc-400 stroke-zinc-400 group-hover:fill-white group-hover:stroke-white"
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 mb-3 flex w-16 -translate-x-1/2 flex-col items-center rounded-2xl border border-white/10 bg-zinc-900/95 px-3 py-4 shadow-lg shadow-black/30 ring-1 ring-white/10 backdrop-blur-sm">
          <span className="text-xs text-zinc-400">{volumePercent}%</span>
          <div className="my-4 flex h-28 items-center justify-center">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              onChange={(event) =>
                player.setVolume(Number(event.currentTarget.value) / 100)
              }
              aria-label="Volume level"
              className="h-2 w-24 -rotate-90 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
            />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Volume
          </span>
        </div>
      )}
    </div>
  )
}
