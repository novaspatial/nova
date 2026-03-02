'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpTrayIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  CheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import type { ProjectStatus } from '@/types/portal'
import clsx from 'clsx'

const steps = [
  {
    key: 'upload',
    label: 'Upload',
    icon: ArrowUpTrayIcon,
  },
  {
    key: 'listen',
    label: 'Listen',
    icon: MusicalNoteIcon,
  },
  {
    key: 'review',
    label: 'Review',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    key: 'deliver',
    label: 'Deliver',
    icon: ArrowDownTrayIcon,
  },
] as const

type StepKey = (typeof steps)[number]['key']

const unlockedSteps: Record<ProjectStatus, StepKey[]> = {
  uploading: ['upload'],
  processing: ['upload'],
  mixing: ['upload'],
  review: ['upload', 'listen', 'review'],
  revision: ['upload', 'listen', 'review'],
  approved: ['upload', 'listen', 'review', 'deliver'],
  delivered: ['upload', 'listen', 'review', 'deliver'],
}

// Studio can access listen/review during processing/mixing to preview their uploads
const studioUnlockedSteps: Record<ProjectStatus, StepKey[]> = {
  uploading: ['upload'],
  processing: ['upload', 'listen', 'review'],
  mixing: ['upload', 'listen', 'review'],
  review: ['upload', 'listen', 'review', 'deliver'],
  revision: ['upload', 'listen', 'review', 'deliver'],
  approved: ['upload', 'listen', 'review', 'deliver'],
  delivered: ['upload', 'listen', 'review', 'deliver'],
}

export function StepNavigation({
  projectId,
  status,
  isStudio = false,
}: {
  projectId: string
  status: ProjectStatus
  isStudio?: boolean
}) {
  const pathname = usePathname()
  const allowed = isStudio ? studioUnlockedSteps[status] : unlockedSteps[status]

  return (
    <nav className="flex gap-1 rounded-2xl border border-white/10 bg-white/2 p-1.5 backdrop-blur-sm sm:gap-2 sm:p-2">
      {steps.map((step) => {
        const isActive = pathname.endsWith(`/${step.key}`)
        const isUnlocked = allowed.includes(step.key)
        const isCompleted =
          allowed.indexOf(step.key) <
          allowed.indexOf(
            pathname.split('/').pop() as StepKey,
          )
        const Icon = step.icon

        if (!isUnlocked) {
          return (
            <div
              key={step.key}
              className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 opacity-40 sm:gap-2 sm:px-4 sm:py-3"
            >
              <LockClosedIcon className="size-4 text-zinc-500 sm:size-5" />
              <span className="hidden text-xs font-medium text-zinc-500 sm:inline sm:text-sm">
                {step.label}
              </span>
            </div>
          )
        }

        return (
          <Link
            key={step.key}
            href={`/portal/${projectId}/${step.key}`}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm',
              isActive
                ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white',
            )}
          >
            {isCompleted ? (
              <CheckIcon className="size-4 text-emerald-400 sm:size-5" />
            ) : (
              <Icon className="size-4 sm:size-5" />
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
