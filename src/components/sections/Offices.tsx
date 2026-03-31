import clsx from 'clsx'

function Office({
  name,
  children,
  invert = false,
}: {
  name: string
  children: React.ReactNode
  invert?: boolean
}) {
  return (
    <address
      className={clsx(
        'text-sm not-italic',
        invert ? 'text-zinc-600' : 'text-zinc-300',
      )}
    >
      <strong className={invert ? 'text-zinc-950' : 'text-white'}>
        {name}
      </strong>
      <br />
      {children}
    </address>
  )
}

export function Offices({
  invert = false,
  ...props
}: React.ComponentPropsWithoutRef<'ul'> & { invert?: boolean }) {
  return (
    <ul role="list" {...props}>
      <li>
        <Office name="North Vancouver" invert={invert}>
          340 Brooksbank Ave.
          <br />
          North Vancouver V7J2C1
        </Office>
      </li>
    </ul>
  )
}
