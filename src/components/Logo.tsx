import { useId } from 'react'
import clsx from 'clsx'

export function Logomark({
  invert = false,
  filled = false,
  ...props
}: React.ComponentPropsWithoutRef<'svg'> & {
  invert?: boolean
  filled?: boolean
}) {
  let id = useId()

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <rect
        clipPath={`url(#${id}-clip)`}
        className={clsx(
          'w-8 transition-all duration-700',
          invert ? 'fill-neutral-950' : 'fill-white',
          filled ? 'h-8' : 'h-0 group-hover/logo:h-8',
        )}
      />
      <use
        href={`#${id}-path`}
        className={invert ? 'stroke-neutral-950' : 'stroke-violet-500'}
        fill="none"
        strokeWidth="1.5"
        filter={invert ? undefined : `url(#${id}-glow)`}
      />
      <defs>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#8b5cf6" floodOpacity="0.6" />
        </filter>
        <path
          id={`${id}-path`}
          d="M5 23 L11 9 L14 9 L8 23Z M14 23 L20 9 L23 9 L17 23Z"
        />
        <clipPath id={`${id}-clip`}>
          <use href={`#${id}-path`} />
        </clipPath>
      </defs>
    </svg>
  )
}

export function Logo({
  className,
  invert = false,
  filled = false,
  fillOnHover = false,
  ...props
}: React.ComponentPropsWithoutRef<'svg'> & {
  invert?: boolean
  filled?: boolean
  fillOnHover?: boolean
}) {
  return (
    <svg
      viewBox="0 0 180 32"
      aria-hidden="true"
      className={clsx(fillOnHover && 'group/logo', className)}
      {...props}
    >
      <Logomark
        preserveAspectRatio="xMinYMid meet"
        invert={invert}
        filled={filled}
      />
      <text
        className={invert ? 'fill-neutral-950' : 'fill-white'}
        x="28"
        y="23"
        fontSize="18"
        fontWeight="600"
        fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
        letterSpacing="-0.02em"
      >
        NovaSpatial
      </text>
    </svg>
  )
}
