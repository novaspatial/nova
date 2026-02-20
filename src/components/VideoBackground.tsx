'use client'

import { useEffect, useRef, useState } from 'react'

export function VideoBackground({
  src,
  poster,
}: {
  src: string
  poster?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function handleCanPlay() {
      setIsLoaded(true)
    }

    video.addEventListener('canplaythrough', handleCanPlay)
    return () => video.removeEventListener('canplaythrough', handleCanPlay)
  }, [])

  return (
    <div className="relative mx-4 mt-2 mb-4 overflow-hidden rounded-4xl bg-zinc-900">
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800 rounded-4xl" />
      )}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={poster}
        className={`h-full w-full object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}
