
import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
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


export function Testimonials() {
  return (
    <div className="mt-16 mb-16 sm:mt-24 sm:mb-32 md:mt-32 xl:mt-40 xl:mb-40 3xl:mt-52 3xl:mb-52">
      <Container>
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-xl font-medium tracking-tight text-white sm:text-2xl md:text-4xl lg:text-5xl 3xl:text-6xl">
              Over 20 Years of Mixing Excellence
            </h2>
          </div>
          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-4 sm:mt-10 sm:grid-cols-4 sm:gap-6 md:gap-10 3xl:mt-12 3xl:max-w-4xl 3xl:gap-14">
            {highlights.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="group flex cursor-pointer flex-col items-center gap-1.5 sm:gap-3 3xl:gap-4"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:shadow-lg group-hover:shadow-violet-500/20 group-hover:ring-white/20 sm:size-16 3xl:size-20">
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
