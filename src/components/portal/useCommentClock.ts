'use client'

// The Comment clock (CONTEXT.md): the Listen-step machine that captures the
// time range a Comment refers to. off — no timestamp will be attached;
// armed — waiting for the reviewer to type, which marks the start; live — the
// end anchor tracks playback; locked — the range is finalized. The hook owns
// every transition and the player-anchor writes; ReviewTimeline only reports
// events (button toggle, composer keydown, anchor-B drag, submit) and renders
// `state`/`disabled`.

import { useCallback, useEffect, useState } from 'react'

export type CommentClockState = 'off' | 'armed' | 'live' | 'locked'

// Structural subset of the AudioProvider player the clock touches — the object
// returned by useAudioPlayer() satisfies it, and tests can hand in a 7-member
// fake without mounting the provider.
export type CommentClockPlayer = {
  currentTime: number
  duration: number
  playing: boolean
  mixedMusicFile: { id: string | number } | null
  setAnchorA(ms: number): void
  setAnchorB(ms: number): void
  clearSelection(): void
}

export type ComposerKeyEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

export function useCommentClock(
  player: CommentClockPlayer,
  selectedTrackId: string | null,
) {
  const [state, setState] = useState<CommentClockState>('off')

  const disabled =
    !player.mixedMusicFile ||
    String(player.mixedMusicFile.id) !== selectedTrackId

  const toggle = useCallback(() => {
    if (disabled) return
    if (state === 'off') {
      setState('armed')
    } else if (state === 'armed') {
      setState('off')
    } else if (state === 'live') {
      setState('locked')
    } else {
      player.clearSelection()
      setState('off')
    }
  }, [disabled, state, player])

  const handleComposerKeyDown = useCallback(
    (event: ComposerKeyEvent) => {
      if (state !== 'armed') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const isPrintable = event.key.length === 1
      const isEditingKey =
        event.key === 'Backspace' ||
        event.key === 'Delete' ||
        event.key === 'Enter'
      if (!isPrintable && !isEditingKey) return
      if (!Number.isFinite(player.currentTime)) return
      const nowMs = Math.round(player.currentTime * 1000)
      player.setAnchorA(nowMs)
      player.setAnchorB(nowMs)
      setState('live')
    },
    [state, player],
  )

  const handleAnchorBDrag = useCallback(() => {
    setState((s) => (s === 'live' ? 'locked' : s))
  }, [])

  const clear = useCallback(() => {
    player.clearSelection()
    setState('off')
  }, [player])

  // No clearSelection here: the provider already clears anchors when the
  // loaded track changes.
  useEffect(() => {
    if (disabled) setState('off')
  }, [disabled])

  // While live, the end anchor advances by extrapolating from the last
  // reported currentTime against the wall clock (native timeupdate only fires
  // a few times a second). currentTime stays in the deps on purpose: each
  // timeupdate re-runs the effect and re-bases the loop against real audio
  // time; the whole player object is deliberately excluded.
  useEffect(() => {
    if (state !== 'live' || !player.playing) return
    if (!Number.isFinite(player.currentTime)) return
    let rafId = 0
    const baseTime = player.currentTime
    const baseWall =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tick = () => {
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsed = (now - baseWall) / 1000
      const next = baseTime + elapsed
      const clamped =
        Number.isFinite(player.duration) && player.duration > 0
          ? Math.min(next, player.duration)
          : next
      if (Number.isFinite(clamped)) {
        player.setAnchorB(Math.round(clamped * 1000))
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, player.playing, player.currentTime, player.duration])

  return {
    state,
    disabled,
    toggle,
    handleComposerKeyDown,
    handleAnchorBDrag,
    clear,
  }
}
