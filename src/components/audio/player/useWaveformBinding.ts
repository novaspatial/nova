'use client'

import { useEffect, useRef, useState } from 'react'

import { useAudioPlayer } from '@/components/audio/AudioProvider'
import { formatHumanTime } from '@/components/audio/player/Slider'

export function useWaveformBinding() {
  const player = useAudioPlayer()
  const wasPlayingRef = useRef(false)
  const [currentTime, setCurrentTime] = useState<number | null>(
    player.currentTime,
  )
  const [smoothTime, setSmoothTime] = useState(player.currentTime)

  useEffect(() => {
    setCurrentTime(null)
  }, [player.currentTime])

  useEffect(() => {
    setSmoothTime(player.currentTime)
    if (!player.playing) return
    let rafId = 0
    const baseTime = player.currentTime
    const baseWall =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tick = () => {
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsed = (now - baseWall) / 1000
      const next = baseTime + elapsed
      setSmoothTime(
        player.duration > 0 ? Math.min(next, player.duration) : next,
      )
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [player.playing, player.currentTime, player.duration])

  const elapsedSeconds = currentTime ?? smoothTime
  const safeDuration =
    Number.isFinite(player.duration) && player.duration > 0
      ? player.duration
      : 0
  const hasDuration = safeDuration > 0
  const toFinite = (n: number | null | undefined): number => {
    if (n == null || !Number.isFinite(n)) return 0
    if (safeDuration > 0) return Math.min(Math.max(n, 0), safeDuration)
    return Math.max(n, 0)
  }
  const sliderValue = toFinite(currentTime ?? player.currentTime)
  const sliderMax = safeDuration > 0 ? safeDuration : 1

  const waveformProps = {
    label: 'Current time',
    src: player.mixedMusicFile?.audio.src ?? null,
    maxValue: sliderMax,
    step: 0.01,
    value: [sliderValue],
    progressSeconds: elapsedSeconds,
    onChange: ([value]: number[]) => setCurrentTime(value),
    onChangeEnd: ([value]: number[]) => {
      player.seek(value)
      if (wasPlayingRef.current) {
        player.play()
      }
    },
    numberFormatter: { format: formatHumanTime },
    onChangeStart: () => {
      wasPlayingRef.current = player.playing
      player.pause()
    },
    rangeSeconds: player.selection
      ? {
          a:
            player.selection.anchorAMs != null
              ? player.selection.anchorAMs / 1000
              : null,
          b:
            player.selection.anchorBMs != null
              ? player.selection.anchorBMs / 1000
              : null,
        }
      : undefined,
    onDragAnchor: (which: 'a' | 'b', seconds: number) => {
      player.updateAnchor(
        which === 'a' ? 'A' : 'B',
        Math.round(seconds * 1000),
      )
    },
  }

  return { player, waveformProps, elapsedSeconds, hasDuration }
}
