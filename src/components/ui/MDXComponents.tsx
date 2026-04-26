import clsx from 'clsx'

import { Border } from '@/components/ui/Border'

export const MDXComponents = {
  TopTip({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) {
    return (
      <Border position="left" className={clsx('my-10 pl-8', className)}>
        <p className="font-display text-sm font-bold tracking-widest text-white uppercase">
          Top tip
        </p>
        <div className="mt-4">{children}</div>
      </Border>
    )
  },
  wrapper({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return (
      <div
        className={clsx(
          '*:mx-auto *:max-w-3xl [&>:first-child]:mt-0! [&>:last-child]:mb-0!',
          className,
        )}
        {...props}
      />
    )
  },
}
