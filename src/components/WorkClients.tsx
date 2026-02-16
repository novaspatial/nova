import Image from 'next/image'
import { Border } from '@/components/Border'
import { Container } from '@/components/Container'
import { FadeIn, FadeInStagger } from '@/components/FadeIn'
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
          You're in good company
        </h2>
      </FadeIn>
      <FadeInStagger className="mt-10" faster>
        <Border as={FadeIn} />
        <ul
          role="list"
          className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4"
        >
          {workClients.map(([client, logo]) => (
            <li key={client} className="group">
              <FadeIn className="overflow-hidden">
                <Border className="pt-12 group-nth-[-n+2]:-mt-px sm:group-nth-3:-mt-px lg:group-nth-4:-mt-px">
                  <Image src={logo} alt={client} unoptimized />
                </Border>
              </FadeIn>
            </li>
          ))}
        </ul>
      </FadeInStagger>
    </Container>
  )
}
