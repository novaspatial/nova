import clsx from 'clsx'

export function TagList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul
      role="list"
      className={clsx(
        className,
        'flex flex-wrap gap-1 sm:gap-4 xl:gap-2 3xl:gap-3',
      )}
    >
      {children}
    </ul>
  )
}

export function TagListItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <li
      className={clsx(
        'rounded-full bg-zinc-900/90 px-1 py-px text-[7px] text-white ring-1 ring-white/10 backdrop-blur-sm sm:px-4 sm:py-1.5 sm:text-base xl:px-2.5 xl:py-0.5 xl:text-xs 3xl:px-3 3xl:py-1 3xl:text-sm',
        className,
      )}
    >
      {children}
    </li>
  )
}
