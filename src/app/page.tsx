import { type Metadata } from 'next'
import { Build } from '@/components/Build'
import { Clients } from '@/components/Clients'
import { Container } from '@/components/Container'
import { Deliver } from '@/components/Deliver'
import { Discover } from '@/components/Discover'
import { FadeIn } from '@/components/FadeIn'
import { RootLayout } from '@/components/RootLayout'
import { Testimonial } from '@/components/Testimonial'
import { FAQ } from '@/components/FAQ'
import { Values } from '@/components/Values'
import { WorkClients } from '@/components/WorkClients'
import logoMailSmirkDark from '@/images/clients/mail-smirk/logo-dark.svg'

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
            Award-winning development studio based in Denmark.
          </h1>
          <p className="mt-6 text-xl text-neutral-600">
            We are a development studio working at the intersection of design
            and technology. It's a really busy intersection though — a lot of
            our staff have been involved in hit and runs.
          </p>
        </FadeIn>
      </Container>
      <WorkClients />

      <Clients />

      <div className="mt-24 space-y-24 [counter-reset:section] sm:mt-32 sm:space-y-32 lg:mt-40 lg:space-y-40">
        <Discover />
        <Build />
        <Deliver />
      </div>

      <Values />



      <Testimonial
        className="mt-24 sm:mt-32 lg:mt-40"
        client={{ name: 'Mail Smirk', logo: logoMailSmirkDark }}
      >
        We approached <em>Studio</em> because we loved their past work. They
        delivered something remarkably similar in record time.
      </Testimonial>
      <FAQ />
    </RootLayout>
  )
}
