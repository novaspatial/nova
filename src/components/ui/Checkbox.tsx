'use client'

import { CheckIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useRef } from 'react'
import {
  type AriaCheckboxProps,
  mergeProps,
  useCheckbox,
  useFocusRing,
  VisuallyHidden,
} from 'react-aria'
import { useToggleState } from 'react-stately'

type CheckboxProps = AriaCheckboxProps & {
  className?: string
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  const { children, isDisabled, isIndeterminate } = props
  const state = useToggleState(props)
  const inputRef = useRef<HTMLInputElement>(null)
  const { inputProps, labelProps } = useCheckbox(props, state, inputRef)
  const { isFocusVisible, focusProps } = useFocusRing()

  const isSelected = state.isSelected && !isIndeterminate
  const isActive = isSelected || isIndeterminate

  return (
    <label
      {...labelProps}
      className={clsx(
        'group inline-flex items-start gap-3 text-sm text-white/70',
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <VisuallyHidden>
        <input {...mergeProps(inputProps, focusProps)} ref={inputRef} />
      </VisuallyHidden>
      <span
        aria-hidden="true"
        className={clsx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition',
          isActive
            ? 'border-transparent bg-gradient-to-r from-violet-900 via-purple-800 to-violet-900 text-white'
            : 'border-white/20 bg-transparent',
          isFocusVisible && 'ring-4 ring-violet-500/20',
          !isDisabled && !isActive && 'group-hover:border-violet-400',
        )}
      >
        {isSelected && <CheckIcon className="size-3.5" />}
        {isIndeterminate && <span className="h-0.5 w-2.5 rounded-full bg-white" />}
      </span>
      {children && <span className="leading-snug">{children}</span>}
    </label>
  )
}
