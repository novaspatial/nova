import clsx from 'clsx'

export function TagList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul role="list" className={clsx(className, 'flex flex-wrap gap-4')}>
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
        'rounded-full bg-gradient-to-r from-indigo-900/20 via-violet-800/20 to-purple-900/20 px-4 py-1.5 text-base text-white',
        className,
      )}
    >
      {children}
    </li>
  )
}
