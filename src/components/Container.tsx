import clsx from 'clsx'

type ContainerProps<T extends React.ElementType> = {
  as?: T
  className?: string
  children: React.ReactNode
}

export function Container<T extends React.ElementType = 'div'>({
  as,
  className,
  children,
}: Omit<React.ComponentPropsWithoutRef<T>, keyof ContainerProps<T>> &
  ContainerProps<T>) {
  let Component = as ?? 'div'

  return (
    <Component className={clsx('mx-auto max-w-7xl xl:max-w-[90rem] 3xl:max-w-[100rem] px-6 lg:px-8 xl:px-12 3xl:px-16', className)}>
      <div className="mx-auto max-w-2xl lg:max-w-none">{children}</div>
    </Component>
  )
}
