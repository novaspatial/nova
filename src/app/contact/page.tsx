import { type Metadata } from 'next'
import Link from 'next/link'

import { Border } from '@/components/ui/Border'
import { ContactForm } from '@/components/sections/ContactForm'
import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { Offices } from '@/components/sections/Offices'
import { PageIntro } from '@/components/ui/PageIntro'
import { RootLayout } from '@/components/layout/RootLayout'

function ContactDetails() {
  return (
    <FadeIn>
      <h2 className="font-display text-base font-semibold text-white">
        Our offices
      </h2>
      <Offices className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2" />

      <Border className="mt-16 pt-16">
        <h2 className="font-display text-base font-semibold text-white">
          Email us
        </h2>
        <dl className="mt-6 grid grid-cols-1 gap-8 text-sm sm:grid-cols-2">
          {[
            ['Contact', 'contact@nova-spatial.com'],
          ].map(([label, email]) => (
            <div key={email}>
              <dt className="font-semibold text-white">{label}</dt>
              <dd>
                <Link
                  href={`mailto:${email}`}
                  className="text-white hover:text-violet-300"
                >
                  {email}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </Border>
    </FadeIn>
  )
}

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Let’s work together. We can’t wait to hear from you.',
  alternates: { canonical: '/contact' },
}

export default function Contact() {
  return (
    <RootLayout>
      <PageIntro eyebrow="Contact us" title="Let’s work together">
        <p>Experience NOVA Spatial</p>
      </PageIntro>

      <Container className="mt-24 sm:mt-32 lg:mt-40">
        <div className="grid grid-cols-1 gap-x-8 gap-y-24 lg:grid-cols-2">
          <ContactForm />
          <ContactDetails />
        </div>
      </Container>
    </RootLayout>
  )
}
