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
        <h2 className="font-display text-base font-medium tracking-tight text-white sm:text-2xl xl:text-4xl 3xl:text-6xl">
          Trusted by Industry Giants
        </h2>
      </FadeIn>
      <FadeIn>
        <div className="group relative  sm:mt-10 overflow-hidden border-t border-neutral-700 pt-2 sm:pt-12">
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
                   className="relative h-8 w-42 sm:h-10 sm:w-48 xl:h-11 xl:w-50 3xl:h-18 3xl:w-72 shrink-0"
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
