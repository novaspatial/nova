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
const DEFAULT_VIEW_HEIGHT = 40
const DEFAULT_BAR_MIN_HEIGHT = 2
const DEFAULT_BAR_WIDTH = 2
const DEFAULT_BAR_GAP = 1

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

// Module-level caches survive component unmount on purpose: navigating away
// and back to the same mix should not re-decode the audio. `peakPromises`
// dedupes concurrent fetches for the same URL so parallel Waveform mounts
// share a single decode. HIGH_RES_BINS = 4096 is the bucket count for the
// decoded peaks — high enough that zooming in stays crisp without blowing
// up memory for long tracks.
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
          'pointer-events-auto absolute top-0 left-1/2 h-[130%] -translate-x-1/2 translate-y-[38%] bg-violet-300 shadow-[0_0_6px_var(--color-violet-400)]',
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
  rangeSeconds?: { a: number | null; b: number | null }
  onDragAnchor?: (which: 'a' | 'b', seconds: number) => void
  height?: number
  barWidth?: number
  barGap?: number
  barMinHeight?: number
}

function RangeHandle({
  which,
  seconds,
  maxValue,
  trackRef,
  onDragAnchor,
}: {
  which: 'a' | 'b'
  seconds: number
  maxValue: number
  trackRef: React.RefObject<HTMLDivElement | null>
  onDragAnchor: (which: 'a' | 'b', seconds: number) => void
}) {
  const percent = maxValue > 0 ? Math.min(1, Math.max(0, seconds / maxValue)) : 0

  const secondsFromClientX = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return seconds
    const ratio = (clientX - rect.left) / rect.width
    return Math.min(maxValue, Math.max(0, ratio * maxValue))
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={
        which === 'a' ? 'Range anchor A handle' : 'Range anchor B handle'
      }
      aria-valuemin={0}
      aria-valuemax={maxValue}
      aria-valuenow={seconds}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        onDragAnchor(which, secondsFromClientX(event.clientX))
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onKeyDown={(event) => {
        const big = event.shiftKey ? 1 : 0.1
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault()
          onDragAnchor(which, Math.max(0, seconds - big))
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault()
          onDragAnchor(which, Math.min(maxValue, seconds + big))
        } else if (event.key === 'Home') {
          event.preventDefault()
          onDragAnchor(which, 0)
        } else if (event.key === 'End') {
          event.preventDefault()
          onDragAnchor(which, maxValue)
        }
      }}
      className="pointer-events-auto absolute inset-y-0 z-10 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center touch-none focus:outline-none"
      style={{ left: `${percent * 100}%` }}
    >
      <div className="relative h-[130%] w-0.5 translate-y-[-0%] rounded-full bg-violet-200 shadow-[0_0_6px_var(--color-violet-400)]">
        <span className="absolute -top-1 left-1/2 block size-1.5 -translate-x-1/2 rounded-full bg-violet-200" />
        <span className="absolute -bottom-1 left-1/2 block size-1.5 -translate-x-1/2 rounded-full bg-violet-200" />
      </div>
    </div>
  )
}

export function Waveform(props: WaveformProps) {
  const viewHeight = props.height ?? DEFAULT_VIEW_HEIGHT
  const barWidth = props.barWidth ?? DEFAULT_BAR_WIDTH
  const barGap = props.barGap ?? DEFAULT_BAR_GAP
  const barMinHeight = props.barMinHeight ?? DEFAULT_BAR_MIN_HEIGHT
  const barPitch = barWidth + barGap

  const trackRef = useRef<HTMLDivElement>(null)
  const state = useSliderState({
    ...props,
    numberFormatter: props.numberFormatter as Intl.NumberFormat,
  })
  const { groupProps, trackProps, labelProps } = useSlider(
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

  const barCount = Math.max(1, Math.floor(trackWidth / barPitch))

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

  const isDragging = state.isThumbDragging(0)
  const displayProgress = isDragging
    ? state.getThumbPercent(0)
    : props.maxValue > 0
      ? Math.min(1, Math.max(0, props.progressSeconds / props.maxValue))
      : 0
  const playedBars = Math.round(displayProgress * barCount)
  const viewWidth = trackWidth || barCount * barPitch
  const isActive = isFocusVisible || isDragging

  const rangeA = props.rangeSeconds?.a ?? null
  const rangeB = props.rangeSeconds?.b ?? null
  const hasRange = rangeA != null && rangeB != null && props.maxValue > 0
  const rangeStartPct = hasRange
    ? Math.min(1, Math.max(0, Math.min(rangeA, rangeB) / props.maxValue))
    : 0
  const rangeEndPct = hasRange
    ? Math.min(1, Math.max(0, Math.max(rangeA, rangeB) / props.maxValue))
    : 0

  const barsSvg = useMemo(() => {
    if (!displayPeaks) return null
    return (
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        aria-hidden="true"
      >
        {displayPeaks.map((peak, i) => {
          const height = Math.max(barMinHeight, peak * viewHeight)
          const x = i * barPitch
          const y = (viewHeight - height) / 2
          const played = i < playedBars
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
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
  }, [
    displayPeaks,
    viewWidth,
    viewHeight,
    playedBars,
    isActive,
    barMinHeight,
    barPitch,
    barWidth,
  ])

  const skeletonSvg = useMemo(() => {
    if (!skeletonPeaks) return null
    return (
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        className={clsx('block h-full w-full', !peaksError && 'animate-pulse')}
        aria-hidden="true"
      >
        {skeletonPeaks.map((peak, i) => {
          const height = Math.max(barMinHeight, peak * viewHeight)
          const x = i * barPitch
          const y = (viewHeight - height) / 2
          const played = i < playedBars
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
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
  }, [
    skeletonPeaks,
    viewWidth,
    viewHeight,
    playedBars,
    isActive,
    peaksError,
    barMinHeight,
    barPitch,
    barWidth,
  ])

  return (
    <div
      {...groupProps}
      className="flex min-w-0 flex-1 touch-none items-center"
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
        className="relative w-full cursor-pointer"
        style={{ height: `${viewHeight}px` }}
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
        {hasRange && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 bg-violet-400/15"
            style={{
              left: `${rangeStartPct * 100}%`,
              width: `${(rangeEndPct - rangeStartPct) * 100}%`,
            }}
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
        {hasRange && props.onDragAnchor && (
          <>
            <RangeHandle
              which="a"
              seconds={rangeA!}
              maxValue={props.maxValue}
              trackRef={trackRef}
              onDragAnchor={props.onDragAnchor}
            />
            <RangeHandle
              which="b"
              seconds={rangeB!}
              maxValue={props.maxValue}
              trackRef={trackRef}
              onDragAnchor={props.onDragAnchor}
            />
          </>
        )}
      </div>
    </div>
  )
}

export function formatTrackTime(seconds: number, totalSeconds: number): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(seconds) ? seconds : 0),
  )
  const safeTotal = Math.max(
    0,
    Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0),
  )
  return formatTime(parseTime(safeSeconds), parseTime(safeTotal))
}
