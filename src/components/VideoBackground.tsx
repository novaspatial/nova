'use client'

export function VideoBackground({ src }: { src: string }) {
  return (
    <div className="mx-4 overflow-hidden rounded-4xl mt-2 mb-4">
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
