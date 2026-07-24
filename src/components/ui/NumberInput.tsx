'use client'

import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const stepperButtonClassName =
  'flex size-5 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-300 transition hover:border-violet-500/40 hover:bg-violet-500/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

export function NumberInput({
  id,
  value,
  onChange,
  label,
  min = 1,
  max,
  step = 1,
  required,
  placeholder,
  disabled,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Names the field in the stepper buttons' aria-labels. */
  label: string
  min?: number
  max?: number
  step?: number
  required?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const numeric = value.trim() === '' ? NaN : Number(value)

  // Custom stepper (native number spinners are hidden for house style).
  // Empty/invalid input resolves to min on the first step.
  const adjust = (delta: number) => {
    const base = Number.isInteger(numeric) ? numeric : min - delta
    const next = Math.max(min, max === undefined ? base + delta : Math.min(max, base + delta))
    onChange(String(next))
  }

  return (
    <div className={clsx('relative', className)}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        required={required}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-xs text-white [appearance:textfield] placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        disabled={disabled}
      />
      <div className="absolute inset-y-0 right-2 flex flex-col justify-center gap-0.5">
        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={disabled || (max !== undefined && numeric >= max)}
          aria-label={`Increase ${label}`}
          tabIndex={-1}
          className={stepperButtonClassName}
        >
          <ChevronUpIcon className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={disabled || !(numeric > min)}
          aria-label={`Decrease ${label}`}
          tabIndex={-1}
          className={stepperButtonClassName}
        >
          <ChevronDownIcon className="size-3" />
        </button>
      </div>
    </div>
  )
}
