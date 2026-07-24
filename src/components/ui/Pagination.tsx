'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const arrowClassName =
  'flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:border-violet-500/40 hover:bg-violet-500/15 hover:text-white disabled:pointer-events-none disabled:opacity-40'

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={arrowClassName}
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="text-xs text-zinc-400 tabular-nums sm:text-sm">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
        className={arrowClassName}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}
