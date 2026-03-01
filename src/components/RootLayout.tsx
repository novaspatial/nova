'use client'

import { Container } from '@/components/Container'
import { Footer } from '@/components/Footer'
import { GridPattern } from '@/components/GridPattern'
import { Navbar } from '@/components/Navbar'
import dynamic from 'next/dynamic'

const VideoBackground = dynamic(
  () =>
    import('@/components/VideoBackground').then((mod) => ({
      default: mod.VideoBackground,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 mt-2 mb-4 overflow-hidden rounded-4xl">
        <div className="aspect-[2.4/1] animate-pulse bg-zinc-800" />
      </div>
    ),
  },
)

function RootLayoutInner({
  children,
  videoSrc,
}: {
  children: React.ReactNode
  videoSrc?: string
}) {
  return (
    <>
      <Navbar />

      {videoSrc && (
        <div className="bg-zinc-950">
          <VideoBackground src={videoSrc} poster="/videos/hero-bg-poster.jpg" />
        </div>
      )}

      <div className="relative flex flex-auto overflow-hidden bg-zinc-950">
        <div className="relative isolate flex w-full flex-col">
          <GridPattern
            className="absolute inset-x-0 -top-14 -z-10 h-[1000px] w-full mask-[linear-gradient(to_bottom_left,white_40%,transparent_50%)] fill-violet-500/5 stroke-purple-500/10"
            yOffset={-96}
            interactive
          />

          <main className="w-full flex-auto">{children}</main>

          <Footer />
        </div>
      </div>
    </>
  )
}

export function RootLayout({
  children,
  videoSrc,
}: {
  children: React.ReactNode
  videoSrc?: string
}) {
  return <RootLayoutInner videoSrc={videoSrc}>{children}</RootLayoutInner>
}
