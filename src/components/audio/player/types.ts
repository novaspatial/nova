import type { MixedMusicFile } from '@/components/audio/AudioProvider'

export type AudioPlayerAPI = {
  playing: boolean
  muted: boolean
  volume: number
  duration: number
  currentTime: number
  mixedMusicFile: MixedMusicFile | null
  play(): void
  pause(): void
  toggle(): void
  seekBy(amount: number): void
  seek(time: number): void
  playbackRate(rate: number): void
  setVolume(volume: number): void
  isPlaying(file?: MixedMusicFile): boolean
  clear(): void
}
