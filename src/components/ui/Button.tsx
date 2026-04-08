import clsx from 'clsx'
import Link from 'next/link'

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
    'inline-flex rounded-2xl px-2 py-1 text-[10px] font-bold transition-all duration-300 ease-in-out sm:px-4 sm:py-2 sm:text-base',
    invert
      ? 'bg-zinc-950 text-white hover:bg-zinc-800'
      : 'bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 text-white ring-1 ring-violet-500/20 hover:from-violet-900 hover:via-purple-800 hover:to-violet-900 hover:ring-violet-400/30 hover:scale-[1.02]',
  )

  const inner = <span className="relative top-px">{children}</span>

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
