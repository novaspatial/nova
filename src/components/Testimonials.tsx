
import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import Image from 'next/image'
import imageBlakeReid from '@/images/team/blake-reid.jpg'
import imageChelseaHagon from '@/images/team/chelsea-hagon.jpg'
import imageDriesVincent from '@/images/team/dries-vincent.jpg'
import {
  ClockIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'

const highlights = [
  { icon: ClockIcon, label: '20+ Years Experience' },
  { icon: TrophyIcon, label: 'Award-Winning Quality' },
  { icon: ShieldCheckIcon, label: 'Secure & Fast Delivery' },
  { icon: UserGroupIcon, label: 'Client Focused' },
]

const testimonials = [
  {
    body: 'NOVA nailed the Atmos mix. They kept the exact punch and emotion of my original stereo master, but made it feel massive.',
    author: {
      name: 'Snotty Nose Rez Kids',
      handle: 'Sony Music – Album of the Year 2025 Juno Awards',
      image: imageDriesVincent,
    },
  },
  {
    body: 'Finally, an immersive mixing team that understands how to translate dense modern mixes to Atmos. The Spatial Tone Lock process is the real deal.',
    author: {
      name: 'Producer Name',
      handle: 'Platinum-Selling Producer',
      image: imageChelseaHagon,
    },
  },
  {
    body: 'The remote workflow was incredibly smooth. Being able to listen to binaural references and leave timestamped notes made the whole process effortless.',
    author: {
      name: 'Manager Name',
      handle: 'Band',
      image: imageBlakeReid,
    },
  },
]

export function Testimonials() {
  return (
    <div className="mt-8 mb-16 sm:mt-24 sm:mb-32 md:mt-32 xl:mt-40 xl:mb-40 3xl:mt-52 3xl:mb-52">
      <Container>
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <span className="mb-3 block font-display text-xs font-semibold text-white sm:mb-6 sm:text-base 3xl:mb-8 3xl:text-lg">
              Client Success
            </span>
            <h2 className="font-display text-xl font-medium tracking-tight text-white sm:text-2xl md:text-4xl lg:text-5xl 3xl:text-6xl">
              Over 20 Years of Mixing Excellence
            </h2>
          </div>
          <div className="mx-auto mt-8 flow-root max-w-2xl sm:mt-12 md:mt-16 lg:mx-0 lg:max-w-none">
            <div className="-mt-6 space-y-6 sm:-mt-8 sm:-mx-4 sm:space-y-0 sm:columns-2 sm:text-[0] lg:columns-3">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.author.name}
                  className="pt-6 sm:inline-block sm:w-full sm:pt-8 sm:px-4"
                >
                  <figure className="min-w-0 rounded-2xl bg-white/5 p-4 text-sm leading-relaxed ring-1 ring-white/10 sm:p-6 lg:p-8">
                    <blockquote className="text-zinc-300">
                      <p className="text-sm sm:text-base">&ldquo;{testimonial.body}&rdquo;</p>
                    </blockquote>
                    <figcaption className="mt-4 flex min-w-0 items-center gap-x-3 sm:mt-6 sm:gap-x-4">
                      <Image
                        src={testimonial.author.image}
                        alt={`User profile picture of ${testimonial.author.name}`}
                        className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">
                          {testimonial.author.name}
                        </div>
                        <div className="truncate text-xs text-zinc-400 sm:text-sm">
                          {testimonial.author.handle}
                        </div>
                      </div>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-4 sm:mt-10 sm:grid-cols-4 sm:gap-6 md:gap-10 3xl:mt-12 3xl:max-w-4xl 3xl:gap-14">
            {highlights.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="group flex cursor-pointer flex-col items-center gap-1.5 sm:gap-3 3xl:gap-4"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:shadow-lg group-hover:shadow-white/5 group-hover:ring-white/25 sm:size-16 3xl:size-20">
                  <Icon className="size-6 text-white transition-transform duration-300 group-hover:scale-110 sm:size-8 3xl:size-10" />
                </div>
                <span className="text-center text-xs font-medium text-zinc-300 transition-colors duration-300 group-hover:text-white sm:text-sm 3xl:text-base">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </Container>
    </div>
  )
}
