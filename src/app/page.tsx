import { Container } from '@/components/Container'
import { Services } from '@/components/Services'
import { FadeIn } from '@/components/FadeIn'
import { FAQ } from '@/components/FAQ'
import { HeroContent } from '@/components/HeroContent'
import { HowItWorks } from '@/components/HowItWorks'
import { PromoPopup } from '@/components/PromoPopup'
import { EmailCapturePopup } from '@/components/EmailCapturePopup'
import { RootLayout } from '@/components/RootLayout'
import { Testimonials } from '@/components/Testimonials'
import { Clients } from '@/components/Clients'
import { type Metadata } from 'next'

export const metadata: Metadata = {
  description:
    'We are a development studio working at the intersection of design and technology.',
}

export default function Home() {
  return (
    <RootLayout videoSrc="/videos/hero-bg.mp4">
      <Container className="relative mt-16 sm:mt-24 md:mt-36 xl:mt-44 3xl:mt-56">
        <FadeIn className="max-w-5xl xl:max-w-6xl 3xl:max-w-7xl">
          <HeroContent />
        </FadeIn>
        <PromoPopup />
        <EmailCapturePopup />
      </Container>
      <Clients />
      <Services />
      <Testimonials />
      <HowItWorks />
      <FAQ />
    </RootLayout>
  )
}
