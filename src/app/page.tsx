import { type Metadata } from 'next'
import { Build } from '@/components/Build'
import { Container } from '@/components/Container'
import { Deliver } from '@/components/Deliver'
import { Discover } from '@/components/Discover'
import { FadeIn } from '@/components/FadeIn'
import { RootLayout } from '@/components/RootLayout'
import { FAQ } from '@/components/FAQ'
import { HeroContent } from '@/components/HeroContent'
import { PromoPopup } from '@/components/PromoPopup'
import { Testimonials } from '@/components/Testimonials'
import { WorkClients } from '@/components/WorkClients'

export const metadata: Metadata = {
  description:
    'We are a development studio working at the intersection of design and technology.',
}

export default function Home() {
  return (
    <RootLayout videoSrc="/videos/hero-bg.mp4">
      <Container className="relative mt-16 sm:mt-24 md:mt-36 xl:mt-44 3xl:mt-56">
        <FadeIn className="max-w-3xl xl:max-w-4xl 3xl:max-w-5xl">
          <HeroContent />
        </FadeIn>
        <PromoPopup />
      </Container>
      <div className="mt-28 mb-24 sm:mt-52 sm:mb-40 xl:mt-40 xl:mb-52 3xl:mt-52 3xl:mb-68">
        <WorkClients />
      </div>


      <div className="mt-8 space-y-24 [counter-reset:section] sm:mt-10 sm:space-y-32 lg:mt-12 lg:space-y-40">
        <Discover />
        <Build />
        <Deliver />
      </div>
      <Testimonials />

      <FAQ />
    </RootLayout>
  )
}
