'use client'

import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  mergeProps,
  useFocusRing,
  useSlider,
  useSliderThumb,
  VisuallyHidden,
} from 'react-aria'
import { useSliderState } from 'react-stately'

const HIGH_RES_BINS = 4096
const VIEW_HEIGHT = 40
const BAR_MIN_HEIGHT = 2
const BAR_WIDTH = 2
const BAR_GAP = 1
const BAR_PITCH = BAR_WIDTH + BAR_GAP

function parseTime(seconds: number): [number, number, number] {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds - hours * 3600) / 60)
  seconds = seconds - hours * 3600 - minutes * 60
  return [hours, minutes, seconds]
}

function formatTime(
  seconds: [number, number, number],
  totalSeconds: [number, number, number] = seconds,
): string {
  const totalWithoutLeadingZeroes = totalSeconds.slice(
    totalSeconds.findIndex((x) => x !== 0),
  )
  return seconds
    .slice(seconds.length - totalWithoutLeadingZeroes.length)
    .map((x) => x.toString().padStart(2, '0'))
    .join(':')
}

const peakCache = new Map<string, number[]>()
const peakPromises = new Map<string, Promise<number[]>>()

function fetchPeaks(src: string, bins: number): Promise<number[]> {
  const cached = peakCache.get(src)
  if (cached) return Promise.resolve(cached)

  const inflight = peakPromises.get(src)
  if (inflight) return inflight

  const promise = (async () => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtx) throw new Error('AudioContext unavailable')

    const response = await fetch(src)
    if (!response.ok) throw new Error('Failed to load audio for waveform')
    const arrayBuffer = await response.arrayBuffer()

    const ctx = new AudioCtx()
    try {
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      const channelCount = Math.min(2, decoded.numberOfChannels)
      const samples = decoded.length
      const step = Math.max(1, Math.floor(samples / bins))
      const peaks = new Array<number>(bins).fill(0)

      for (let c = 0; c < channelCount; c++) {
        const channel = decoded.getChannelData(c)
        for (let b = 0; b < bins; b++) {
          const start = b * step
          const end = Math.min(samples, start + step)
          let max = peaks[b]
          for (let i = start; i < end; i++) {
            const v = Math.abs(channel[i])
            if (v > max) max = v
          }
          peaks[b] = max
        }
      }

      let maxPeak = 0
      for (const p of peaks) if (p > maxPeak) maxPeak = p
      const normalized =
        maxPeak > 0 ? peaks.map((p) => p / maxPeak) : peaks.map(() => 0)
      peakCache.set(src, normalized)
      return normalized
    } finally {
      if (typeof ctx.close === 'function') {
        ctx.close().catch(() => {})
      }
    }
  })()

  peakPromises.set(src, promise)
  promise.finally(() => peakPromises.delete(src))
  return promise
}

export function prefetchWaveformPeaks(src: string | null | undefined): void {
  if (!src || typeof window === 'undefined') return
  if (peakCache.has(src) || peakPromises.has(src)) return
  fetchPeaks(src, HIGH_RES_BINS).catch(() => {})
}

function Thumb({
  state,
  trackRef,
  focusProps,
  isFocusVisible,
  index,
  onChangeStart,
  displayPercent,
}: {
  state: ReturnType<typeof useSliderState>
  trackRef: React.RefObject<HTMLDivElement | null>
  focusProps: ReturnType<typeof useFocusRing>['focusProps']
  isFocusVisible: boolean
  index: number
  onChangeStart?: () => void
  displayPercent: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { thumbProps, inputProps } = useSliderThumb(
    { index, trackRef, inputRef },
    state,
  )

  return (
    <div
      className="pointer-events-none absolute inset-y-0 -translate-x-1/2"
      style={{
        left: `${displayPercent * 100}%`,
      }}
    >
      <div
        {...thumbProps}
        onMouseDown={(...args) => {
          thumbProps.onMouseDown?.(...args)
          onChangeStart?.()
        }}
        onPointerDown={(...args) => {
          thumbProps.onPointerDown?.(...args)
          onChangeStart?.()
        }}
        className={clsx(
          'pointer-events-auto absolute top-0 left-1/2 h-[160%] -translate-x-1/2 translate-y-1/4 bg-violet-300 shadow-[0_0_6px_var(--color-violet-400)]',
          isFocusVisible || state.isThumbDragging(index) ? 'w-0.5' : 'w-px',
        )}
      >
        <VisuallyHidden>
          <input ref={inputRef} {...mergeProps(inputProps, focusProps)} />
        </VisuallyHidden>
      </div>
    </div>
  )
}

type WaveformProps = {
  label: string
  src: string | null
  maxValue: number
  step: number
  value: number[]
  progressSeconds: number
  onChange: (value: number[]) => void
  onChangeEnd: (value: number[]) => void
  onChangeStart?: () => void
  numberFormatter: Intl.NumberFormat | { format: (value: number) => string }
}

export function Waveform(props: WaveformProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const state = useSliderState({
    ...props,
    numberFormatter: props.numberFormatter as Intl.NumberFormat,
  })
  const { groupProps, trackProps, labelProps, outputProps } = useSlider(
    props,
    state,
    trackRef,
  )
  const { focusProps, isFocusVisible } = useFocusRing()

  const [peaks, setPeaks] = useState<number[] | null>(() =>
    props.src ? (peakCache.get(props.src) ?? null) : null,
  )
  const [peaksError, setPeaksError] = useState(false)

  useEffect(() => {
    if (!props.src) {
      setPeaks(null)
      setPeaksError(false)
      return
    }
    const cached = peakCache.get(props.src)
    if (cached) {
      setPeaks(cached)
      setPeaksError(false)
      return
    }

    let cancelled = false
    setPeaks(null)
    setPeaksError(false)
    fetchPeaks(props.src, HIGH_RES_BINS)
      .then((result) => {
        if (!cancelled) setPeaks(result)
      })
      .catch(() => {
        if (!cancelled) setPeaksError(true)
      })
    return () => {
      cancelled = true
    }
  }, [props.src])

  const [trackWidth, setTrackWidth] = useState(0)
  useEffect(() => {
    const node = trackRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setTrackWidth(Math.round(width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const barCount = Math.max(1, Math.floor(trackWidth / BAR_PITCH))

  const displayPeaks = useMemo(() => {
    if (!peaks || barCount <= 0) return null
    if (peaks.length === barCount) return peaks
    const result = new Array<number>(barCount).fill(0)
    const ratio = peaks.length / barCount
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.max(start + 1, Math.floor((i + 1) * ratio))
      let max = 0
      for (let j = start; j < end && j < peaks.length; j++) {
        const v = peaks[j]
        if (v > max) max = v
      }
      result[i] = max
    }
    return result
  }, [peaks, barCount])

  const skeletonPeaks = useMemo(() => {
    if (displayPeaks || barCount <= 0) return null
    const result = new Array<number>(barCount)
    for (let i = 0; i < barCount; i++) {
      const a = Math.sin(i * 0.19) * 0.5 + 0.5
      const b = Math.sin(i * 0.53 + 1.7) * 0.5 + 0.5
      result[i] = 0.2 + 0.4 * (a * 0.6 + b * 0.4)
    }
    return result
  }, [displayPeaks, barCount])

  const totalTime = parseTime(state.getThumbMaxValue(0))
  const isDragging = state.isThumbDragging(0)
  const displayProgress = isDragging
    ? state.getThumbPercent(0)
    : props.maxValue > 0
      ? Math.min(1, Math.max(0, props.progressSeconds / props.maxValue))
      : 0
  const currentTime = parseTime(
    Math.floor(isDragging ? state.getThumbValue(0) : props.progressSeconds),
  )
  const playedBars = Math.round(displayProgress * barCount)
  const viewWidth = trackWidth || barCount * BAR_PITCH
  const isActive = isFocusVisible || isDragging

  const barsSvg = useMemo(() => {
    if (!displayPeaks) return null
    return (
      <svg
        viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        aria-hidden="true"
      >
        {displayPeaks.map((peak, i) => {
          const height = Math.max(BAR_MIN_HEIGHT, peak * VIEW_HEIGHT)
          const x = i * BAR_PITCH
          const y = (VIEW_HEIGHT - height) / 2
          const played = i < playedBars
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={height}
              rx={0.5}
              className={clsx(
                played
                  ? isActive
                    ? 'fill-violet-400'
                    : 'fill-violet-500'
                  : 'fill-white/20',
              )}
            />
          )
        })}
      </svg>
    )
  }, [displayPeaks, viewWidth, playedBars, isActive])

  const skeletonSvg = useMemo(() => {
    if (!skeletonPeaks) return null
    return (
      <svg
        viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className={clsx(
          'block h-full w-full',
          !peaksError && 'animate-pulse',
        )}
        aria-hidden="true"
      >
        {skeletonPeaks.map((peak, i) => {
          const height = Math.max(BAR_MIN_HEIGHT, peak * VIEW_HEIGHT)
          const x = i * BAR_PITCH
          const y = (VIEW_HEIGHT - height) / 2
          const played = i < playedBars
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={height}
              rx={0.5}
              className={clsx(
                played
                  ? isActive
                    ? 'fill-violet-400/70'
                    : 'fill-violet-500/70'
                  : 'fill-white/10',
              )}
            />
          )
        })}
      </svg>
    )
  }, [skeletonPeaks, viewWidth, playedBars, isActive, peaksError])

  return (
    <div
      {...groupProps}
      className="absolute inset-x-0 bottom-full flex flex-auto touch-none items-center gap-6 md:relative"
    >
      {props.label && (
        <label className="sr-only" {...labelProps}>
          {props.label}
        </label>
      )}
      <div
        {...trackProps}
        onMouseDown={(...args) => {
          trackProps.onMouseDown?.(...args)
          props.onChangeStart?.()
        }}
        onPointerDown={(...args) => {
          trackProps.onPointerDown?.(...args)
          props.onChangeStart?.()
        }}
        ref={trackRef}
        className="relative h-10 w-full cursor-pointer"
      >
        {barsSvg ? (
          barsSvg
        ) : skeletonSvg ? (
          skeletonSvg
        ) : (
          <div
            className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/10"
            aria-hidden="true"
          />
        )}
        <Thumb
          index={0}
          state={state}
          trackRef={trackRef}
          onChangeStart={props.onChangeStart}
          focusProps={focusProps}
          isFocusVisible={isFocusVisible}
          displayPercent={displayProgress}
        />
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <output
          {...outputProps}
          aria-live="off"
          className={clsx(
            'hidden rounded-md px-1 py-0.5 font-mono text-base/6 md:block',
            state.getThumbMaxValue(0) === 0 && 'opacity-0',
            isActive ? 'bg-white/10 text-white' : 'text-zinc-400',
          )}
        >
          {formatTime(currentTime, totalTime)}
        </output>
        <span className="text-base/6 text-zinc-600" aria-hidden="true">
          /
        </span>
        <span
          className={clsx(
            'hidden rounded-md px-1 py-0.5 font-mono text-base/6 text-zinc-500 md:block',
            state.getThumbMaxValue(0) === 0 && 'opacity-0',
          )}
        >
          {formatTime(totalTime)}
        </span>
      </div>
    </div>
  )
}
