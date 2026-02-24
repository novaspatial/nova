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
        'rounded-full bg-gradient-to-r from-indigo-900/20 via-violet-800/20 to-purple-900/20 px-1.5 py-px text-[8px] text-white sm:px-4 sm:py-1.5 sm:text-base xl:px-2.5 xl:py-0.5 xl:text-xs 3xl:px-3 3xl:py-1 3xl:text-sm',
        className,
      )}
    >
      {children}
    </li>
  )
}
