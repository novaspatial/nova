import { type Metadata } from 'next'
import { Build } from '@/components/Build'
import { Container } from '@/components/Container'
import { Deliver } from '@/components/Deliver'
import { Discover } from '@/components/Discover'
import { FadeIn } from '@/components/FadeIn'
import { RootLayout } from '@/components/RootLayout'
import { FAQ } from '@/components/FAQ'
import { HeroContent } from '@/components/HeroContent'
import { Testimonials } from '@/components/Testimonials'
import { WorkClients } from '@/components/WorkClients'

export const metadata: Metadata = {
  description:
    'We are a development studio working at the intersection of design and technology.',
}

export default function Home() {
  return (
    <RootLayout videoSrc="/nova/videos/hero-bg.mp4">
      <Container className="mt-12 sm:mt-16 md:mt-28">
        <FadeIn className="max-w-3xl">
          <HeroContent />
        </FadeIn>
      </Container>
      <WorkClients />


      <div className="mt-24 space-y-24 [counter-reset:section] sm:mt-32 sm:space-y-32 lg:mt-40 lg:space-y-40">
        <Discover />
        <Build />
        <Deliver />
      </div>
      <Testimonials />

      <FAQ />
    </RootLayout>
  )
}
