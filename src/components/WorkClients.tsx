'use client'

import Image from 'next/image'
import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import logoBrightPathDark from '@/images/clients/bright-path/logo-dark.svg'
import logoFamilyFundDark from '@/images/clients/family-fund/logo-dark.svg'
import logoGreenLifeDark from '@/images/clients/green-life/logo-dark.svg'
import logoHomeWorkDark from '@/images/clients/home-work/logo-dark.svg'
import logoMailSmirkDark from '@/images/clients/mail-smirk/logo-dark.svg'
import logoNorthAdventuresDark from '@/images/clients/north-adventures/logo-dark.svg'
import logoPhobiaDark from '@/images/clients/phobia/logo-dark.svg'
import logoUnsealDark from '@/images/clients/unseal/logo-dark.svg'

const workClients = [
  ['Phobia', logoPhobiaDark],
  ['Family Fund', logoFamilyFundDark],
  ['Unseal', logoUnsealDark],
  ['Mail Smirk', logoMailSmirkDark],
  ['Home Work', logoHomeWorkDark],
  ['Green Life', logoGreenLifeDark],
  ['Bright Path', logoBrightPathDark],
  ['North Adventures', logoNorthAdventuresDark],
]

export function WorkClients() {
  return (
    <Container className="mt-24 sm:mt-32 lg:mt-40">
      <FadeIn>
        <h2 className="font-display text-2xl font-semibold text-neutral-950">
          Trusted by Industry Giants
        </h2>
      </FadeIn>
      <FadeIn>
        <div className="group relative mt-10 overflow-hidden border-t border-neutral-200 pt-12">
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-white to-transparent" />

          <div className="flex gap-x-14">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 animate-marquee items-center gap-x-14 group-hover:pause"
                aria-hidden={copy === 1 ? true : undefined}
              >
                {workClients.map(([client, logo]) => (
                  <div
                    key={client}
                    className="flex w-42 shrink-0 items-center justify-center"
                  >
                    <Image
                      src={logo}
                      alt={client as string}
                      unoptimized
                      className="max-h-12 w-auto"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </Container>
  )
}
