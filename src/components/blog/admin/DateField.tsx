'use client'

import { useMemo, useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toIso(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDisplay(value: string): string {
  const d = parseIso(value)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function monthGrid(year: number, month: number) {
  const startOfMonth = new Date(Date.UTC(year, month, 1))
  const startWeekday = (startOfMonth.getUTCDay() + 6) % 7
  const cells: { iso: string; day: number; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month, 1 - startWeekday + i))
    cells.push({
      iso: toIso(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    })
  }
  return cells
}

export function DateField({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}) {
  const initial = value ? parseIso(value) : parseIso(todayIso())
  const [view, setView] = useState({
    year: initial.getUTCFullYear(),
    month: initial.getUTCMonth(),
  })

  const cells = useMemo(() => monthGrid(view.year, view.month), [view])
  const today = todayIso()

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const next = month + delta
      if (next < 0) return { year: year - 1, month: 11 }
      if (next > 11) return { year: year + 1, month: 0 }
      return { year, month: next }
    })
  }

  return (
    <Popover className="relative">
      <PopoverButton
        id={id}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white outline-none transition focus:border-violet-400/40 disabled:opacity-50 data-open:border-violet-400/40"
      >
        <span className={value ? 'text-white' : 'text-zinc-500'}>
          {value ? formatDisplay(value) : 'Pick a date'}
        </span>
        <CalendarIcon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-zinc-400"
        />
      </PopoverButton>
      <PopoverPanel className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-xl outline-none backdrop-blur">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="rounded-lg p-1 text-zinc-300 transition hover:bg-white/10"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-white">
                {MONTHS[view.month]} {view.year}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="rounded-lg p-1 text-zinc-300 transition hover:bg-white/10"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map(({ iso, day, inMonth }) => {
                const isSelected = iso === value
                const isToday = iso === today
                return (
                  <button
                    type="button"
                    key={iso}
                    onClick={() => {
                      onChange(iso)
                      close()
                    }}
                    className={[
                      'flex h-8 items-center justify-center rounded-lg text-xs transition',
                      isSelected
                        ? 'bg-violet-500/30 text-white ring-1 ring-violet-400/40'
                        : inMonth
                          ? 'text-zinc-200 hover:bg-white/10'
                          : 'text-zinc-600 hover:bg-white/5',
                      isToday && !isSelected ? 'ring-1 ring-white/15' : '',
                    ].join(' ')}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => {
                  const t = todayIso()
                  const d = parseIso(t)
                  onChange(t)
                  setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
                  close()
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    close()
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/10"
                >
                  Clear
                </button>
              )}
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}
