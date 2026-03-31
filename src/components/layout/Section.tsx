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
      <div
        className={clsx(
          'lg:flex lg:justify-end lg:gap-x-8 lg:group-even/section:justify-start xl:gap-x-20 3xl:gap-x-24',
          plainImage ? 'lg:items-start' : 'lg:items-center',
        )}
      >
        <div className={clsx(
          'flex justify-center',
          plainImage && 'lg:sticky lg:top-28',
        )}>
          <FadeIn className="w-72 flex-none sm:w-135 lg:w-200 3xl:w-224">
            <StylizedImage
              {...image}
              plain={plainImage}
              sizes="(min-width: 1400px) 56rem, (min-width: 1024px) 50rem, (min-width: 640px) 31rem, 14rem"
              className="justify-center lg:justify-end lg:group-even/section:justify-start"
            />
          </FadeIn>
        </div>
        <div className="mt-8 sm:mt-12 lg:mt-0 lg:w-148 lg:flex-none lg:group-even/section:order-first 3xl:w-160">
          <FadeIn>
            <h2 className="font-display text-xl font-medium tracking-tight text-white sm:text-4xl 3xl:text-5xl">
              {title}
            </h2>
            <div className="mt-4 text-white sm:mt-6 3xl:mt-8">{children}</div>
          </FadeIn>
        </div>
      </div>
    </Container>
  )
}
