import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useCommentClock } from './useCommentClock'
import type { CommentClockPlayer, ComposerKeyEvent } from './useCommentClock'

function makePlayer(
  overrides: Partial<CommentClockPlayer> = {},
): CommentClockPlayer {
  return {
    currentTime: 0,
    duration: 180,
    playing: false,
    mixedMusicFile: { id: 'track-1' },
    setAnchorA: vi.fn(),
    setAnchorB: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides,
  }
}

function keyEvent(
  key: string,
  overrides: Partial<ComposerKeyEvent> = {},
): ComposerKeyEvent {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...overrides }
}

function renderClock(
  player: CommentClockPlayer,
  selectedTrackId: string | null = 'track-1',
) {
  return renderHook(
    (props: { player: CommentClockPlayer; selectedTrackId: string | null }) =>
      useCommentClock(props.player, props.selectedTrackId),
    { initialProps: { player, selectedTrackId } },
  )
}

function armAndGoLive(result: { current: ReturnType<typeof useCommentClock> }) {
  act(() => result.current.toggle())
  act(() => result.current.handleComposerKeyDown(keyEvent('a')))
}

function anchorBCalls(player: CommentClockPlayer) {
  return vi.mocked(player.setAnchorB).mock.calls.map(([ms]) => ms)
}

describe('useCommentClock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('starts off', () => {
    const { result } = renderClock(makePlayer())
    expect(result.current.state).toBe('off')
    expect(result.current.disabled).toBe(false)
  })

  test('arms from off when toggled', () => {
    const { result } = renderClock(makePlayer())
    act(() => result.current.toggle())
    expect(result.current.state).toBe('armed')
  })

  test('disarms without clearing the selection when toggled while armed', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    expect(result.current.state).toBe('off')
    expect(player.clearSelection).not.toHaveBeenCalled()
  })

  test('locks the range when toggled while live', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    armAndGoLive(result)
    act(() => result.current.toggle())
    expect(result.current.state).toBe('locked')
    expect(player.clearSelection).not.toHaveBeenCalled()
  })

  test('clears the selection and turns off when toggled while locked', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    armAndGoLive(result)
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    expect(result.current.state).toBe('off')
    expect(player.clearSelection).toHaveBeenCalledTimes(1)
  })

  test('ignores toggle while disabled', () => {
    const { result } = renderClock(makePlayer({ mixedMusicFile: null }))
    expect(result.current.disabled).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.state).toBe('off')
  })

  test('is disabled when no track is loaded', () => {
    const { result } = renderClock(makePlayer({ mixedMusicFile: null }))
    expect(result.current.disabled).toBe(true)
  })

  test('is disabled when the loaded track is not the selected track', () => {
    const { result } = renderClock(makePlayer(), 'other-track')
    expect(result.current.disabled).toBe(true)
  })

  test('treats numeric track ids as matching their string form', () => {
    const { result } = renderClock(
      makePlayer({ mixedMusicFile: { id: 42 } }),
      '42',
    )
    expect(result.current.disabled).toBe(false)
  })

  test('turns off without clearing the selection when the clock becomes disabled', () => {
    const player = makePlayer()
    const { result, rerender } = renderClock(player)
    armAndGoLive(result)
    expect(result.current.state).toBe('live')
    rerender({ player, selectedTrackId: 'other-track' })
    expect(result.current.state).toBe('off')
    expect(player.clearSelection).not.toHaveBeenCalled()
  })

  test('marks the start at the current time when the reviewer types while armed', () => {
    const player = makePlayer({ currentTime: 12.3456 })
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    act(() => result.current.handleComposerKeyDown(keyEvent('a')))
    expect(player.setAnchorA).toHaveBeenCalledWith(12346)
    expect(player.setAnchorB).toHaveBeenCalledWith(12346)
    expect(result.current.state).toBe('live')
  })

  test('ignores typing when not armed', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    act(() => result.current.handleComposerKeyDown(keyEvent('a')))
    expect(result.current.state).toBe('off')
    expect(player.setAnchorA).not.toHaveBeenCalled()
    armAndGoLive(result)
    act(() => result.current.toggle())
    vi.mocked(player.setAnchorA).mockClear()
    act(() => result.current.handleComposerKeyDown(keyEvent('a')))
    expect(result.current.state).toBe('locked')
    expect(player.setAnchorA).not.toHaveBeenCalled()
  })

  test('ignores modified keys while armed', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    act(() =>
      result.current.handleComposerKeyDown(keyEvent('a', { ctrlKey: true })),
    )
    act(() =>
      result.current.handleComposerKeyDown(keyEvent('a', { metaKey: true })),
    )
    act(() =>
      result.current.handleComposerKeyDown(keyEvent('a', { altKey: true })),
    )
    expect(result.current.state).toBe('armed')
    expect(player.setAnchorA).not.toHaveBeenCalled()
  })

  test('accepts backspace, delete, and enter as marking keys', () => {
    for (const key of ['Backspace', 'Delete', 'Enter']) {
      const player = makePlayer({ currentTime: 5 })
      const { result } = renderClock(player)
      act(() => result.current.toggle())
      act(() => result.current.handleComposerKeyDown(keyEvent(key)))
      expect(result.current.state).toBe('live')
      expect(player.setAnchorA).toHaveBeenCalledWith(5000)
    }
  })

  test('ignores non-printable keys while armed', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    for (const key of ['Shift', 'ArrowLeft', 'Escape']) {
      act(() => result.current.handleComposerKeyDown(keyEvent(key)))
    }
    expect(result.current.state).toBe('armed')
    expect(player.setAnchorA).not.toHaveBeenCalled()
  })

  test('does not mark the start when the current time is not finite', () => {
    const player = makePlayer({ currentTime: Number.NaN })
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    act(() => result.current.handleComposerKeyDown(keyEvent('a')))
    expect(result.current.state).toBe('armed')
    expect(player.setAnchorA).not.toHaveBeenCalled()
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('tracks playback by advancing anchor b while live and playing', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: true, currentTime: 10 })
    const { result } = renderClock(player)
    armAndGoLive(result)
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    const calls = anchorBCalls(player)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((ms) => Number.isInteger(ms))).toBe(true)
    expect(calls.every((ms, i) => i === 0 || ms > calls[i - 1])).toBe(true)
    expect(calls[0]).toBeGreaterThan(10000)
    expect(calls[calls.length - 1]).toBeLessThanOrEqual(10101)
  })

  test('clamps anchor b to the track duration', () => {
    vi.useFakeTimers()
    const player = makePlayer({
      playing: true,
      currentTime: 10,
      duration: 10.5,
    })
    const { result } = renderClock(player)
    armAndGoLive(result)
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const calls = anchorBCalls(player)
    expect(calls.every((ms) => ms <= 10500)).toBe(true)
    expect(calls[calls.length - 1]).toBe(10500)
  })

  test('keeps advancing past an unknown duration', () => {
    vi.useFakeTimers()
    for (const duration of [Number.NaN, 0]) {
      const player = makePlayer({ playing: true, currentTime: 10, duration })
      const { result } = renderClock(player)
      armAndGoLive(result)
      vi.mocked(player.setAnchorB).mockClear()
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      const calls = anchorBCalls(player)
      expect(calls[calls.length - 1]).toBeGreaterThan(11900)
    }
  })

  test('does not track while paused', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: false, currentTime: 10 })
    const { result } = renderClock(player)
    armAndGoLive(result)
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('does not track when not live', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: true, currentTime: 10 })
    const { result } = renderClock(player)
    act(() => result.current.toggle())
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.state).toBe('armed')
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('does not track when the playhead is not finite', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: false, currentTime: 10 })
    const { result, rerender } = renderClock(player)
    armAndGoLive(result)
    rerender({
      player: { ...player, playing: true, currentTime: Number.NaN },
      selectedTrackId: 'track-1',
    })
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('re-bases on a native time update while live', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: true, currentTime: 10 })
    const { result, rerender } = renderClock(player)
    armAndGoLive(result)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({
      player: { ...player, currentTime: 12 },
      selectedTrackId: 'track-1',
    })
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    const calls = anchorBCalls(player)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0]).toBeGreaterThanOrEqual(12000)
    expect(calls[calls.length - 1]).toBeLessThanOrEqual(12101)
  })

  test('stops tracking when the clock locks', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: true, currentTime: 10 })
    const { result } = renderClock(player)
    armAndGoLive(result)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => result.current.toggle())
    expect(result.current.state).toBe('locked')
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('stops tracking on unmount', () => {
    vi.useFakeTimers()
    const player = makePlayer({ playing: true, currentTime: 10 })
    const { result, unmount } = renderClock(player)
    armAndGoLive(result)
    unmount()
    vi.mocked(player.setAnchorB).mockClear()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(player.setAnchorB).not.toHaveBeenCalled()
  })

  test('locks when anchor b is dragged while live', () => {
    const { result } = renderClock(makePlayer())
    armAndGoLive(result)
    act(() => result.current.handleAnchorBDrag())
    expect(result.current.state).toBe('locked')
  })

  test('ignores anchor b drags when not live', () => {
    const { result } = renderClock(makePlayer())
    act(() => result.current.handleAnchorBDrag())
    expect(result.current.state).toBe('off')
    act(() => result.current.toggle())
    act(() => result.current.handleAnchorBDrag())
    expect(result.current.state).toBe('armed')
    act(() => result.current.handleComposerKeyDown(keyEvent('a')))
    act(() => result.current.handleAnchorBDrag())
    act(() => result.current.handleAnchorBDrag())
    expect(result.current.state).toBe('locked')
  })

  test('clears the selection and turns off on clear', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    armAndGoLive(result)
    act(() => result.current.clear())
    expect(result.current.state).toBe('off')
    expect(player.clearSelection).toHaveBeenCalledTimes(1)
  })

  test('clears from a locked range too', () => {
    const player = makePlayer()
    const { result } = renderClock(player)
    armAndGoLive(result)
    act(() => result.current.handleAnchorBDrag())
    act(() => result.current.clear())
    expect(result.current.state).toBe('off')
    expect(player.clearSelection).toHaveBeenCalledTimes(1)
  })
})
