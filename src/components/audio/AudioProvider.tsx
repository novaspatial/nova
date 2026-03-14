'use client'

import {
  createContext,
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
  mixedMusicFile: MixedMusicFile | null
}

type AudioPlayerAPI = AudioPlayerState & {
  muted: boolean
  play(mixedMusicFile?: MixedMusicFile): void
  pause(): void
  toggle(mixedMusicFile?: MixedMusicFile): void
  seekBy(amount: number): void
  seek(time: number): void
  playbackRate(rate: number): void
  setVolume(volume: number): void
  isPlaying(mixedMusicFile?: MixedMusicFile): boolean
  clear(): void
}

type Action =
  | { type: 'SET_META'; payload: MixedMusicFile | null }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }

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
  }
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume))
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
    mixedMusicFile: null,
  })
  const playerRef = useRef<HTMLAudioElement>(null)

  const actions = useMemo(() => {
    const play = (file?: MixedMusicFile) => {
      const current = file || state.mixedMusicFile
      if (!current?.audio?.src) return

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
      return isPlaying(current ?? undefined) ? pause() : play(current ?? undefined)
    }

    return {
      play,
      pause,
      toggle,
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
      isPlaying,
      clear() {
        dispatch({ type: 'SET_META', payload: null })
        playerRef.current?.pause()
      },
    }
  }, [state.playing, state.mixedMusicFile])

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = state.volume
    }
  }, [state.volume])

  const api = useMemo(
    () => ({ ...state, muted: state.volume === 0, ...actions }),
    [state, actions],
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
            payload: Math.floor(event.currentTarget.currentTime),
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
