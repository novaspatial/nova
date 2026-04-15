import { Container } from '@/components/layout/Container'
import { Services } from '@/components/sections/Services'
import { FadeIn } from '@/components/ui/FadeIn'
import { FAQ } from '@/components/sections/FAQ'
import { HeroContent } from '@/components/sections/HeroContent'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { PromoPopup } from '@/components/popups/PromoPopup'
import { RootLayout } from '@/components/layout/RootLayout'
import { heroBgPosterSrc, heroBgVideoSrc } from '@/lib/hero-assets'
import { Testimonials } from '@/components/sections/Testimonials'
import { Clients } from '@/components/sections/Clients'

export default function Home() {
  return (
    <RootLayout videoSrc={heroBgVideoSrc} videoPoster={heroBgPosterSrc}>
      <Container className="relative mt-16 sm:mt-24 md:mt-36 xl:mt-44 3xl:mt-56">
        <FadeIn>
          <HeroContent />
        </FadeIn>
        <PromoPopup />
      </Container>
      <Clients />
      <Services />
      <Testimonials />
      <HowItWorks />
      <FAQ />
    </RootLayout>
  )
}
