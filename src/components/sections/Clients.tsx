import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import logoAmazonMusic from '@/images/clients/amazon-music/logo.png'
import logoApple from '@/images/clients/apple/logo.png'
import logoAtc from '@/images/clients/atc/logo.png'
import logoDolbyAtmos from '@/images/clients/dolby-atmos/logo.png'
import logoEmmy from '@/images/clients/emmy/logo.png'
import logoGoogle from '@/images/clients/google/logo.png'
import logoJunoAwards from '@/images/clients/juno-awards/logo.png'
import logoNetflix from '@/images/clients/netflix/logo.png'
import logoNeumann from '@/images/clients/neumann/logo.png'
import logoSony from '@/images/clients/sony/logo.png'
import logoSpatialAudio from '@/images/clients/spatial-audio/logo.png'
import logoTidal from '@/images/clients/tidal/logo.png'
import logoUniversal from '@/images/clients/universal/logo.png'
import logoWarnerMusicGroup from '@/images/clients/warner-music-group/logo.png'
import logoYouTubeMusic from '@/images/clients/youtube-music/logo.png'
import Image, { StaticImageData } from 'next/image'

type Client = {
  name: string
  logo: StaticImageData
  // Optical-weight multiplier applied to the row height.
  // <1 for dense/tall marks, >1 for thin wordmarks that need to breathe.
  scale?: number
}

const clients: Client[] = [
  { name: 'Universal', logo: logoUniversal, scale: 1.05 },
  { name: 'YouTube Music', logo: logoYouTubeMusic, scale: 0.9 },
  { name: 'Warner Music Group', logo: logoWarnerMusicGroup, scale: 1.1 },
  { name: 'Tidal', logo: logoTidal, scale: 0.85 },
  { name: 'Sony', logo: logoSony, scale: 0.95 },
  { name: 'Spatial Audio', logo: logoSpatialAudio },
  { name: 'Neumann', logo: logoNeumann, scale: 1.15 },
  { name: 'ATC', logo: logoAtc, scale: 1.2 },
  { name: 'Juno Awards', logo: logoJunoAwards, scale: 1.2 },
  { name: 'Google', logo: logoGoogle },
  { name: 'Dolby Atmos', logo: logoDolbyAtmos, scale: 0.9 },
  { name: 'Apple', logo: logoApple, scale: 1.25 },
  { name: 'Amazon Music', logo: logoAmazonMusic },
  { name: 'Emmy', logo: logoEmmy, scale: 1.2 },
  { name: 'Netflix', logo: logoNetflix, scale: 0.95 },
]

export function Clients() {
  return (
    <div className="mt-14 mb-16 sm:mt-52 sm:mb-40 xl:mt-40 xl:mb-52 3xl:mt-52 3xl:mb-68">
      <Container className="mt-12 sm:mt-32 lg:mt-40">
      <FadeIn>
        <h2 className="font-display text-sm font-medium tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] sm:text-[1.125rem] md:text-[1.3125rem] lg:text-[1.5625rem] xl:text-[1.75rem] 3xl:text-[2.75rem]">
          Trusted by Industry Leaders for Unrivaled Audio Mixes
        </h2>
      </FadeIn>
      <FadeIn>
        <div className="group relative overflow-hidden border-t border-white/30 pt-2 sm:mt-4 sm:pt-6">
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-gray-950 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-gray-950 to-transparent" />

          <div className="flex gap-x-14">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 animate-marquee items-center gap-x-10 group-hover:pause sm:gap-x-12 xl:gap-x-14 3xl:gap-x-20"
                aria-hidden={copy === 1 ? true : undefined}
              >
                {clients.map(({ name, logo, scale = 1 }) => (
                  <div
                    key={name}
                    className="flex h-[calc(20px*var(--logo-scale))] shrink-0 items-center sm:h-[calc(24px*var(--logo-scale))] xl:h-[calc(28px*var(--logo-scale))] 3xl:h-[calc(40px*var(--logo-scale))]"
                    style={{ ['--logo-scale' as string]: scale }}
                  >
                    <Image
                      src={logo}
                      alt={name}
                      width={logo.width}
                      height={logo.height}
                      unoptimized
                      className="h-full w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </Container>
    </div>
  )
}
