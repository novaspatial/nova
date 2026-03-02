'use client'

import type { ProjectStatus } from '@/types/portal'

const statusConfig: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  uploading: {
    label: 'Uploading',
    className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  },
  processing: {
    label: 'Processing',
    className: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  },
  mixing: {
    label: 'Mixing',
    className: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  },
  review: {
    label: 'In Review',
    className: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  },
  revision: {
    label: 'Revision',
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
