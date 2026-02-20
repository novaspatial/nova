import clsx from 'clsx'

export function TagList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul role="list" className={clsx(className, 'flex flex-wrap gap-1 sm:gap-4 3xl:gap-5')}>
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
        'rounded-full bg-gradient-to-r from-indigo-900/20 via-violet-800/20 to-purple-900/20 px-1.5 sm:px-4 3xl:px-5 py-px sm:py-1.5 3xl:py-2 text-[8px] sm:text-base 3xl:text-lg text-white',
        className,
      )}
    >
      {children}
    </li>
  )
}
