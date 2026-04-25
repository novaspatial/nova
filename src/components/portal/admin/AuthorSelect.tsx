'use client'

import Image from 'next/image'

import { TEAM_MEMBERS, getAuthor } from '@/lib/team'

export function AuthorSelect({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (slug: string) => void
  id?: string
}) {
  const selected = getAuthor(value)

  return (
    <div className="flex items-center gap-3">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
      >
        {!selected && <option value="">— pick an author —</option>}
        {TEAM_MEMBERS.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name} — {m.role}
          </option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-2">
          <Image
            alt=""
            src={selected.image.src}
            className="h-8 w-8 rounded-full object-cover grayscale"
          />
          <span className="text-xs text-zinc-400">{selected.role}</span>
        </div>
      )}
    </div>
  )
}
