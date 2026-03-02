import type { MixedMusicFile } from '@/components/audio/AudioProvider'

export type AudioPlayerAPI = {
  playing: boolean
  muted: boolean
  duration: number
  currentTime: number
  mixedMusicFile: MixedMusicFile | null
  play(): void
  pause(): void
  toggle(): void
  seekBy(amount: number): void
  seek(time: number): void
  playbackRate(rate: number): void
  toggleMute(): void
  isPlaying(file?: MixedMusicFile): boolean
  clear(): void
}
