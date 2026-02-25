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
import Image from 'next/image'

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
        <h2 className="font-display text-sm font-medium tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] sm:text-[1rem] md:text-[1.125rem] lg:text-[1.3125rem] xl:text-[1.5625rem] 3xl:text-[2.4375rem]">
          Trusted by Industry Leaders for Unrivaled Immersive Audio Mixes
        </h2>
      </FadeIn>
      <FadeIn>
        <div className="group relative overflow-hidden border-t border-neutral-700 pt-2 sm:mt-4 sm:pt-6">
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
                    className="relative h-7 w-36 shrink-0 sm:h-9 sm:w-44 xl:h-10 xl:w-48 3xl:h-16 3xl:w-64"
                  >
                    <Image
                      src={logo}
                      alt={client as string}
                      fill
                      unoptimized
                      className="object-contain"
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
