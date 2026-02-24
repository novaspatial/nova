import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import { StylizedImage } from '@/components/StylizedImage'

export function Section({
  title,
  image,
  children,
}: {
  title: string
  image: React.ComponentPropsWithoutRef<typeof StylizedImage>
  children: React.ReactNode
}) {
  return (
    <Container className="group/section">
      <div className="lg:flex lg:items-center lg:justify-end lg:gap-x-8 lg:group-even/section:justify-start xl:gap-x-20 3xl:gap-x-24">
        <div className="flex justify-center">
          <FadeIn className="w-72 flex-none sm:w-135 lg:w-200 3xl:w-224">
            <StylizedImage
              {...image}
              sizes="(min-width: 1400px) 56rem, (min-width: 1024px) 50rem, (min-width: 640px) 31rem, 14rem"
              className="justify-center lg:justify-end lg:group-even/section:justify-start"
            />
          </FadeIn>
        </div>
        <div className="mt-8 sm:mt-12 lg:mt-0 lg:w-148 lg:flex-none lg:group-even/section:order-first 3xl:w-160">
          <FadeIn>
            <h2 className="font-display text-2xl font-medium tracking-tight text-white sm:text-4xl 3xl:text-5xl">
              {title}
            </h2>
            <div className="mt-4 text-white sm:mt-6 3xl:mt-8">{children}</div>
          </FadeIn>
        </div>
      </div>
    </Container>
  )
}
