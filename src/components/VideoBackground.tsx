'use client'

export function VideoBackground({ src }: { src: string }) {
  return (
    <div className="mt-24 sm:mt-32 w-full overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  )
}
