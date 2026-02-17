'use client'

import Image from 'next/image'
import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import logoBrightPathLight from '@/images/clients/bright-path/logo-light.svg'
import logoFamilyFundLight from '@/images/clients/family-fund/logo-light.svg'
import logoGreenLifeLight from '@/images/clients/green-life/logo-light.svg'
import logoHomeWorkLight from '@/images/clients/home-work/logo-light.svg'
import logoMailSmirkLight from '@/images/clients/mail-smirk/logo-light.svg'
import logoNorthAdventuresLight from '@/images/clients/north-adventures/logo-light.svg'
import logoPhobiaLight from '@/images/clients/phobia/logo-light.svg'
import logoUnsealLight from '@/images/clients/unseal/logo-light.svg'

const workClients = [
  ['Phobia', logoPhobiaLight],
  ['Family Fund', logoFamilyFundLight],
  ['Unseal', logoUnsealLight],
  ['Mail Smirk', logoMailSmirkLight],
  ['Home Work', logoHomeWorkLight],
  ['Green Life', logoGreenLifeLight],
  ['Bright Path', logoBrightPathLight],
  ['North Adventures', logoNorthAdventuresLight],
]

export function WorkClients() {
  return (
    <Container className="mt-24 sm:mt-32 lg:mt-40">
      <FadeIn>
        <h2 className="font-display text-2xl font-semibold text-white">
          Trusted by Industry Giants
        </h2>
      </FadeIn>
      <FadeIn>
        <div className="group relative mt-10 overflow-hidden border-t border-neutral-700 pt-12">
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-gray-950 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-gray-950 to-transparent" />

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
