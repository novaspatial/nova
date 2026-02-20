import clsx from 'clsx'

import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'

export function SectionIntro({
  title,
  eyebrow,
  children,
  smaller = false,
  invert = false,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof Container>,
  'title' | 'children'
> & {
  title: string
  eyebrow?: string
  children?: React.ReactNode
  smaller?: boolean
  invert?: boolean
}) {
  return (
    <Container {...props}>
      <FadeIn className="max-w-2xl 3xl:max-w-3xl">
        <h2>
          {eyebrow && (
            <>
              <span
                className={clsx(
                  'mb-4 sm:mb-6 3xl:mb-8 block font-display text-xs sm:text-base 3xl:text-lg font-semibold',
                  invert ? 'text-neutral-950' : 'text-white',
                )}
              >
                {eyebrow}
              </span>
              <span className="sr-only"> - </span>
            </>
          )}
          <span
            className={clsx(
              'block font-display tracking-tight text-balance',
              smaller
                ? 'text-xl sm:text-2xl 3xl:text-3xl font-semibold'
                : 'text-2xl font-medium sm:text-4xl lg:text-5xl 3xl:text-6xl',
              invert ? 'text-neutral-950' : 'text-white',
            )}
          >
            {title}
          </span>
        </h2>
        {children && (
          <div
            className={clsx(
              'mt-4 sm:mt-6 3xl:mt-8 text-xs sm:text-xl 3xl:text-2xl',
              invert ? 'text-neutral-600' : 'text-neutral-300',
            )}
          >
            {children}
          </div>
        )}
      </FadeIn>
    </Container>
  )
}
