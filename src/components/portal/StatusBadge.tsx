'use client'

import type { ProjectStatus } from '@/types/portal'
import { getStatusDisplay } from '@/lib/portal/workflow'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, color } = getStatusDisplay(status)

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
      {label}
    </span>
  )
}
