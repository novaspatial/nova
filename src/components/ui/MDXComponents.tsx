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
  AppleMusicCallout({ children }: { children: React.ReactNode }) {
    // `children` is the raw fenced-block text: first line = album URL, the
    // remaining lines = the caption.
    const raw = typeof children === 'string' ? children : ''
    const [href, ...rest] = raw.split('\n')
    const caption = rest.join(' ').trim()
    return (
      <div className="my-10 flex flex-col gap-4 rounded-4xl bg-white/5 p-6 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex-1">
          <p className="font-display text-xs font-bold tracking-widest text-violet-300 uppercase">
            Listen now
          </p>
          {caption && <p className="mt-2 text-base text-zinc-300">{caption}</p>}
        </div>
        <a
          href={href.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
        >
          Apple Music
        </a>
      </div>
    )
  },
  wrapper({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
    return (
      <div
        className={clsx(
          '*:mx-auto *:max-w-165 [&>:first-child]:mt-0! [&>:last-child]:mb-0!',
          className,
        )}
        {...props}
      />
    )
  },
}
