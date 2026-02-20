import Link from 'next/link'
import clsx from 'clsx'

type ButtonProps = {
  invert?: boolean
} & (
  | React.ComponentPropsWithoutRef<typeof Link>
  | (React.ComponentPropsWithoutRef<'button'> & { href?: undefined })
)

export function Button({
  invert = false,
  className,
  children,
  ...props
}: ButtonProps) {
  className = clsx(
    className,
    'inline-flex rounded-full px-6 py-2.5 text-base font-bold transition-all duration-300 ease-in-out',
    invert
      ? 'bg-neutral-950 text-white hover:bg-neutral-800'
      : 'bg-gradient-to-r from-indigo-900/80 via-violet-800/80 to-purple-900/80 text-white shadow-lg shadow-violet-500/20 hover:from-indigo-950 hover:via-violet-900 hover:to-purple-950 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105',
  )

  let inner = <span className="relative top-px">{children}</span>

  if (typeof props.href === 'undefined') {
    return (
      <button className={className} {...props}>
        {inner}
      </button>
    )
  }

  return (
    <Link className={className} {...props}>
      {inner}
    </Link>
  )
}
