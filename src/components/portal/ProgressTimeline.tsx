'use client'

import {
  ArrowUpTrayIcon,
  CogIcon,
  MusicalNoteIcon,
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import type { ProjectStatus } from '@/types/portal'
import { getProgressStage } from '@/lib/portal/workflow'

const timelineSteps = [
  { key: 'uploaded', label: 'Uploaded', icon: ArrowUpTrayIcon },
  { key: 'in_progress', label: 'In Progress', icon: CogIcon },
  { key: 'mixed', label: 'Mixed', icon: MusicalNoteIcon },
] as const

type TimelineStep = (typeof timelineSteps)[number]['key']

function getStepIndex(step: TimelineStep) {
  return timelineSteps.findIndex((s) => s.key === step)
}

export function ProgressTimeline({ status }: { status: ProjectStatus }) {
  const currentStep = getProgressStage(status)
  const rawIndex = getStepIndex(currentStep as TimelineStep)
  const currentIndex = rawIndex === -1 ? timelineSteps.length : rawIndex

  return (
    <div className="rounded-2xl border border-white/10 bg-white/2 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
      <div className="flex items-center">
        {timelineSteps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === timelineSteps.length - 1
          const Icon = step.icon

          return (
            <div
              key={step.key}
              className={clsx('flex items-center', !isLast && 'flex-1')}
            >
              {/* Step icon */}
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'flex size-8 items-center justify-center rounded-full border-2 transition-all sm:size-9',
                    isCompleted &&
                      'border-emerald-400 bg-emerald-400/20',
                    isCurrent &&
                      'border-violet-400 bg-violet-400/20 shadow-lg shadow-violet-500/25',
                    !isCompleted &&
                      !isCurrent &&
                      'border-white/10 bg-white/5',
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="size-4 text-emerald-400" />
                  ) : (
                    <Icon
                      className={clsx(
                        'size-4',
                        isCurrent && 'text-violet-400',
                        !isCurrent && 'text-zinc-500',
                      )}
                    />
                  )}
                </div>
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium sm:text-sm',
                    isCompleted && 'text-emerald-300/80',
                    isCurrent && 'text-violet-300',
                    !isCompleted && !isCurrent && 'text-zinc-500',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-2 mb-5 h-0.5 flex-1 sm:mx-3">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      index < currentIndex
                        ? 'bg-emerald-400/40'
                        : 'bg-white/5',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
