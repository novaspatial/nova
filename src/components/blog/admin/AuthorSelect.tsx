'use client'

import Image from 'next/image'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'

import { TEAM_MEMBERS, getAuthor } from '@/lib/team'

export function AuthorSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string
  onChange: (slug: string) => void
  disabled?: boolean
  id?: string
}) {
  const selected = getAuthor(value)

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative">
        <ListboxButton
          id={id}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white outline-none transition focus:border-violet-400/40 disabled:opacity-50 data-open:border-violet-400/40"
        >
          {selected ? (
            <>
              <Image
                alt=""
                src={selected.image.src}
                className="h-7 w-7 shrink-0 rounded-full object-cover grayscale"
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-white">{selected.name}</span>
                <span className="text-zinc-500"> — {selected.role}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 text-zinc-500">— pick an author —</span>
          )}
          <ChevronUpDownIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-zinc-400"
          />
        </ListboxButton>
        <ListboxOptions
          className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-auto rounded-xl border border-white/10 bg-zinc-950/95 p-1 text-sm shadow-xl outline-none backdrop-blur"
        >
          {TEAM_MEMBERS.map((m) => (
            <ListboxOption
              key={m.slug}
              value={m.slug}
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-focus:bg-white/10"
            >
              <Image
                alt=""
                src={m.image.src}
                className="h-7 w-7 shrink-0 rounded-full object-cover grayscale"
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-white">{m.name}</span>
                <span className="text-zinc-400"> — {m.role}</span>
              </span>
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
