'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'

export type MixedMusicFile = {
  id: string | number
  title: string
  audio: {
    src: string
  }
}

type AudioPlayerState = {
  playing: boolean
  volume: number
  duration: number
  currentTime: number
  loop: boolean
  mixedMusicFile: MixedMusicFile | null
  anchorAMs: number | null
  anchorBMs: number | null
  queue: MixedMusicFile[]
}

export type CommentSelection = {
  anchorAMs: number | null
  anchorBMs: number | null
  startMs: number
  endMs: number
}

type AudioPlayerAPI = AudioPlayerState & {
  muted: boolean
  selection: CommentSelection | null
  hasNext: boolean
  hasPrevious: boolean
  play(mixedMusicFile?: MixedMusicFile): void
  pause(): void
  toggle(mixedMusicFile?: MixedMusicFile): void
  seekBy(amount: number): void
  seek(time: number): void
  playbackRate(rate: number): void
  setVolume(volume: number): void
  setLoop(loop: boolean): void
  toggleLoop(): void
  isPlaying(mixedMusicFile?: MixedMusicFile): boolean
  clear(): void
  setAnchorA(ms: number): void
  setAnchorB(ms: number): void
  updateAnchor(which: 'A' | 'B', ms: number): void
  clearSelection(): void
  setQueue(files: MixedMusicFile[]): void
  next(): void
  previous(): void
}

type Action =
  | { type: 'SET_META'; payload: MixedMusicFile | null }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_LOOP'; payload: boolean }
  | { type: 'SET_ANCHOR_A'; payload: number | null }
  | { type: 'SET_ANCHOR_B'; payload: number | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_QUEUE'; payload: MixedMusicFile[] }

const AudioPlayerContext = createContext<AudioPlayerAPI | null>(null)

function audioReducer(
  state: AudioPlayerState,
  action: Action,
): AudioPlayerState {
  switch (action.type) {
    case 'SET_META':
      return { ...state, mixedMusicFile: action.payload }
    case 'PLAY':
      return { ...state, playing: true }
    case 'PAUSE':
      return { ...state, playing: false }
    case 'SET_VOLUME':
      return { ...state, volume: action.payload }
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload }
    case 'SET_DURATION':
      return { ...state, duration: action.payload }
    case 'SET_LOOP':
      return { ...state, loop: action.payload }
    case 'SET_ANCHOR_A':
      return { ...state, anchorAMs: action.payload }
    case 'SET_ANCHOR_B':
      return { ...state, anchorBMs: action.payload }
    case 'CLEAR_SELECTION':
      return { ...state, anchorAMs: null, anchorBMs: null }
    case 'SET_QUEUE':
      return { ...state, queue: action.payload }
  }
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume))
}

const PLAYABLE_EXTENSIONS = ['.wav', '.bwf']

function isPlayableFormat(src: string): boolean {
  const path = getUrlPath(src).toLowerCase().split('?')[0]
  return PLAYABLE_EXTENSIONS.some((ext) => path.endsWith(ext))
}

function getUrlPath(url: string): string {
  if (!url) return ''
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname
    }
    return url
  } catch {
    const parts = url.split('/')
    return parts[parts.length - 1]
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(audioReducer, {
    playing: false,
    volume: 1,
    duration: 0,
    currentTime: 0,
    loop: false,
    mixedMusicFile: null,
    anchorAMs: null,
    anchorBMs: null,
    queue: [],
  })
  const playerRef = useRef<HTMLAudioElement>(null)

  const setQueue = useCallback((files: MixedMusicFile[]) => {
    dispatch({ type: 'SET_QUEUE', payload: files })
  }, [])

  const actions = useMemo(() => {
    const play = (file?: MixedMusicFile) => {
      const current = file || state.mixedMusicFile
      if (!current?.audio?.src) return
      if (!isPlayableFormat(current.audio.src)) return

      // Resume current file if no new file passed
      if (!file && state.mixedMusicFile) {
        playerRef.current?.play().catch(() => {})
        return
      }

      // Check if same file by ID
      const isSameById =
        state.mixedMusicFile &&
        current.id &&
        state.mixedMusicFile.id === current.id

      // Check if same file by URL
      const currentSrc = playerRef.current?.currentSrc || ''
      const newSrc = current.audio.src
      const isSameByUrl =
        playerRef.current &&
        currentSrc &&
        (getUrlPath(currentSrc) === getUrlPath(newSrc) ||
          currentSrc.includes(newSrc) ||
          newSrc.includes(getUrlPath(currentSrc)))

      if ((isSameById || isSameByUrl) && playerRef.current) {
        // Restore meta after clear() if the same track is reopened
        if (!state.mixedMusicFile) {
          dispatch({ type: 'SET_META', payload: current })
        }
        playerRef.current.play().catch(() => {})
        return
      }

      // Different file — load new audio
      dispatch({ type: 'SET_META', payload: current })

      if (playerRef.current) {
        const rate = playerRef.current.playbackRate
        playerRef.current.src = current.audio.src
        playerRef.current.load()
        playerRef.current.pause()
        playerRef.current.playbackRate = rate
        playerRef.current.currentTime = 0
        playerRef.current.play().catch(() => {})
      }
    }

    const pause = () => {
      playerRef.current?.pause()
    }

    const isPlaying = (file?: MixedMusicFile): boolean => {
      if (!playerRef.current) return false

      const audioIsPlaying =
        !playerRef.current.paused &&
        !playerRef.current.ended &&
        playerRef.current.readyState > 2

      if (!file) return audioIsPlaying && state.playing

      if (!file.audio?.src) return false

      const currentSrc = playerRef.current.currentSrc || ''
      const fileSrc = file.audio.src
      const srcMatches =
        getUrlPath(currentSrc) === getUrlPath(fileSrc) ||
        currentSrc.includes(fileSrc) ||
        fileSrc.includes(getUrlPath(currentSrc)) ||
        (file.id != null && state.mixedMusicFile?.id === file.id)

      return audioIsPlaying && state.playing && srcMatches
    }

    const toggle = (file?: MixedMusicFile) => {
      const current = file || state.mixedMusicFile
      return isPlaying(current ?? undefined)
        ? pause()
        : play(current ?? undefined)
    }

    const findCurrentIndex = () => {
      const current = state.mixedMusicFile
      if (!current) return -1
      return state.queue.findIndex((file) => file.id === current.id)
    }

    return {
      play,
      pause,
      toggle,
      next() {
        const idx = findCurrentIndex()
        if (idx < 0 || idx >= state.queue.length - 1) return
        play(state.queue[idx + 1])
      },
      previous() {
        const currentTime = playerRef.current?.currentTime ?? 0
        if (currentTime > 3) {
          if (playerRef.current) playerRef.current.currentTime = 0
          return
        }
        const idx = findCurrentIndex()
        if (idx <= 0) {
          if (playerRef.current) playerRef.current.currentTime = 0
          return
        }
        play(state.queue[idx - 1])
      },
      seekBy(amount: number) {
        if (playerRef.current) {
          playerRef.current.currentTime += amount
        }
      },
      seek(time: number) {
        if (playerRef.current) {
          playerRef.current.currentTime = time
        }
      },
      playbackRate(rate: number) {
        if (playerRef.current) {
          playerRef.current.playbackRate = rate
        }
      },
      setVolume(volume: number) {
        const nextVolume = clampVolume(volume)

        if (playerRef.current) {
          playerRef.current.volume = nextVolume
        }

        dispatch({ type: 'SET_VOLUME', payload: nextVolume })
      },
      setLoop(loop: boolean) {
        dispatch({ type: 'SET_LOOP', payload: loop })
      },
      toggleLoop() {
        dispatch({ type: 'SET_LOOP', payload: !state.loop })
      },
      isPlaying,
      clear() {
        dispatch({ type: 'SET_META', payload: null })
        playerRef.current?.pause()
      },
      setAnchorA(ms: number) {
        dispatch({ type: 'SET_ANCHOR_A', payload: ms })
      },
      setAnchorB(ms: number) {
        dispatch({ type: 'SET_ANCHOR_B', payload: ms })
      },
      updateAnchor(which: 'A' | 'B', ms: number) {
        dispatch({
          type: which === 'A' ? 'SET_ANCHOR_A' : 'SET_ANCHOR_B',
          payload: ms,
        })
      },
      clearSelection() {
        dispatch({ type: 'CLEAR_SELECTION' })
      },
    }
  }, [state.playing, state.mixedMusicFile, state.loop, state.queue])

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = state.volume
    }
  }, [state.volume])

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.loop = state.loop
    }
  }, [state.loop])

  const mixedMusicFileId = state.mixedMusicFile?.id ?? null
  useEffect(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [mixedMusicFileId])

  const selection = useMemo<CommentSelection | null>(() => {
    const { anchorAMs, anchorBMs } = state
    if (anchorAMs == null && anchorBMs == null) return null
    const a = anchorAMs ?? anchorBMs!
    const b = anchorBMs ?? anchorAMs!
    return {
      anchorAMs,
      anchorBMs,
      startMs: Math.min(a, b),
      endMs: Math.max(a, b),
    }
  }, [state])

  const currentQueueIndex = useMemo(() => {
    if (!state.mixedMusicFile) return -1
    return state.queue.findIndex(
      (file) => file.id === state.mixedMusicFile!.id,
    )
  }, [state.queue, state.mixedMusicFile])

  const hasNext =
    currentQueueIndex >= 0 && currentQueueIndex < state.queue.length - 1
  const hasPrevious = state.mixedMusicFile != null

  const api = useMemo(
    () => ({
      ...state,
      muted: state.volume === 0,
      selection,
      hasNext,
      hasPrevious,
      setQueue,
      ...actions,
    }),
    [state, selection, actions, hasNext, hasPrevious, setQueue],
  )

  return (
    <>
      <AudioPlayerContext.Provider value={api}>
        {children}
      </AudioPlayerContext.Provider>
      <audio
        ref={playerRef}
        onPlay={() => dispatch({ type: 'PLAY' })}
        onPause={() => dispatch({ type: 'PAUSE' })}
        onTimeUpdate={(event) => {
          dispatch({
            type: 'SET_CURRENT_TIME',
            payload: event.currentTarget.currentTime,
          })
        }}
        onDurationChange={(event) => {
          dispatch({
            type: 'SET_DURATION',
            payload: Math.floor(event.currentTarget.duration),
          })
        }}
        preload="metadata"
      />
    </>
  )
}

export function useAudioPlayer(file?: MixedMusicFile) {
  const player = useContext(AudioPlayerContext)

  if (!player) {
    throw new Error('useAudioPlayer must be used within an AudioProvider')
  }

  return useMemo(
    () => ({
      ...player,
      play() {
        player.play(file)
      },
      toggle() {
        player.toggle(file)
      },
      get playing() {
        return player.isPlaying(file)
      },
    }),
    [player, file],
  )
}
