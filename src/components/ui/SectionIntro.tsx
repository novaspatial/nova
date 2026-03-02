import clsx from 'clsx'

import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'

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
                  'mb-4 block font-display text-xs font-semibold sm:mb-6 sm:text-base 3xl:mb-8 3xl:text-lg',
                  invert ? 'text-zinc-950' : 'text-white',
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
                ? 'text-xl font-semibold sm:text-2xl 3xl:text-3xl'
                : 'text-2xl font-medium sm:text-4xl lg:text-5xl 3xl:text-6xl',
              invert ? 'text-zinc-950' : 'text-white',
            )}
          >
            {title}
          </span>
        </h2>
        {children && (
          <div
            className={clsx(
              'mt-4 text-xs sm:mt-6 sm:text-xl 3xl:mt-8 3xl:text-2xl',
              invert ? 'text-zinc-600' : 'text-zinc-300',
            )}
          >
            {children}
          </div>
        )}
      </FadeIn>
    </Container>
  )
}
