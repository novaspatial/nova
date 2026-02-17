import { type Metadata } from 'next'
import { Build } from '@/components/Build'
import { Container } from '@/components/Container'
import { Deliver } from '@/components/Deliver'
import { Discover } from '@/components/Discover'
import { FadeIn } from '@/components/FadeIn'
import { RootLayout } from '@/components/RootLayout'
import { FAQ } from '@/components/FAQ'
import { WorkClients } from '@/components/WorkClients'

export const metadata: Metadata = {
  description:
    'We are a development studio working at the intersection of design and technology.',
}

export default function Home() {
  return (
    <RootLayout videoSrc="/videos/hero-bg.mp4">
      <Container className="mt-24 sm:mt-32 md:mt-56">
        <FadeIn className="max-w-3xl">
          <h1 className="font-display text-5xl font-medium tracking-tight text-balance text-neutral-950 sm:text-7xl">
            Start your Atmos mix with Spatial Tone Lock
          </h1>
          <p className="mt-6 text-xl text-neutral-600">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
          </p>
        </FadeIn>
      </Container>
      <WorkClients />


      <div className="mt-24 space-y-24 [counter-reset:section] sm:mt-32 sm:space-y-32 lg:mt-40 lg:space-y-40">
        <Discover />
        <Build />
        <Deliver />
      </div>

      <FAQ />
    </RootLayout>
  )
}
