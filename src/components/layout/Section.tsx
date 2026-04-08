import clsx from 'clsx'

import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { StylizedImage } from '@/components/ui/StylizedImage'

export function Section({
  title,
  image,
  plainImage = false,
  children,
  ...props
}: {
  title: string
  image: React.ComponentPropsWithoutRef<typeof StylizedImage>
  plainImage?: boolean
  children: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Container {...props} className="group/section scroll-mt-24 sm:scroll-mt-28">
      <FadeIn>
        <h2 className="mb-6 font-display text-xl font-medium tracking-tight text-white sm:mb-8 sm:text-4xl 3xl:mb-10 3xl:text-5xl lg:text-right lg:group-even/section:text-left">
          {title}
        </h2>
      </FadeIn>
      <div
        className={clsx(
          'lg:flex lg:justify-end lg:gap-x-8 lg:group-even/section:justify-start xl:gap-x-14 3xl:gap-x-18',
          plainImage ? 'lg:items-start' : 'lg:items-center',
        )}
      >
        <div className={clsx(
          'flex justify-center',
          plainImage && 'lg:sticky lg:top-28',
        )}>
          <FadeIn className="w-60 flex-none sm:w-112 lg:w-160 3xl:w-192">
            <StylizedImage
              {...image}
              plain={plainImage}
              sizes="(min-width: 1400px) 56rem, (min-width: 1024px) 50rem, (min-width: 640px) 31rem, 14rem"
              className="justify-center lg:justify-end lg:group-even/section:justify-start"
            />
          </FadeIn>
        </div>
        <div className="mt-8 sm:mt-12 lg:mt-0 lg:w-132 lg:flex-none lg:group-even/section:order-first 3xl:w-148">
          <FadeIn>
            <div className="text-white">{children}</div>
          </FadeIn>
        </div>
      </div>
    </Container>
  )
}
