import {
  MusicalNoteIcon,
  StarIcon,
  BoltIcon,
  HeartIcon,
} from '@heroicons/react/24/solid'
import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'

const highlights = [
  { icon: MusicalNoteIcon, label: 'Premium Quality' },
  { icon: StarIcon, label: '5-Star Rated' },
  { icon: BoltIcon, label: 'Fast Delivery' },
  { icon: HeartIcon, label: 'Client Focused' },
]

export function Testimonials() {
  return (
    <div className="mt-24 mb-24 sm:mt-40 sm:mb-40 xl:mt-56 xl:mb-56 3xl:mt-72 3xl:mb-72">
      <Container>
        <FadeIn>
          <div className="flex flex-col items-center text-center max-w-3xl 3xl:max-w-4xl mx-auto">
            <span className="mb-4 sm:mb-6 3xl:mb-8 block font-display text-xs sm:text-base 3xl:text-lg font-semibold text-white">
              Testimonials
            </span>
            <h2 className="font-display text-2xl font-medium tracking-tight text-white sm:text-4xl lg:text-5xl 3xl:text-6xl">
              2000+ Happy Users
            </h2>
            <p className="mt-4 sm:mt-6 3xl:mt-8 text-xs sm:text-xl 3xl:text-2xl text-neutral-300">
              Join thousands of musicians who&apos;ve transformed their sound
              with us. Our clients love the clarity, power, and professionalism
              we bring to every track. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.

            </p>
            <div className="mt-8 sm:mt-12 3xl:mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-10 3xl:gap-14">
              {highlights.map(({ icon: Icon, label }) => (
                <div key={label} className="group flex flex-col items-center gap-2 sm:gap-3 3xl:gap-4 cursor-pointer">
                  <div className="flex items-center justify-center size-10 sm:size-14 3xl:size-16 rounded-full bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:ring-white/25 group-hover:shadow-lg group-hover:shadow-white/5">
                    <Icon className="size-5 sm:size-7 3xl:size-8 text-white transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-xs sm:text-sm 3xl:text-base font-medium text-neutral-300 transition-colors duration-300 group-hover:text-white">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </Container>
    </div>
  )
}
