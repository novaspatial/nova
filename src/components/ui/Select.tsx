'use client'

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export type SelectOption<T extends string> = {
  value: T
  label: string
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  disabled?: boolean
  className?: string
}) {
  const selected = options.find((option) => option.value === value)

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={clsx('relative', className)}>
        <ListboxButton
          id={id}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-white outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 data-open:border-violet-400/40 sm:text-sm"
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
          <ChevronUpDownIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-zinc-400"
          />
        </ListboxButton>
        <ListboxOptions className="absolute right-0 left-0 z-50 mt-2 max-h-72 overflow-auto rounded-xl border border-white/10 bg-zinc-950/95 p-1 text-xs shadow-xl outline-none backdrop-blur sm:text-sm">
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-zinc-200 data-focus:bg-white/10"
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <CheckIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-violet-300 opacity-0 group-data-selected:opacity-100"
              />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}
