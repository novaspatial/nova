'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
  ArrowUpTrayIcon,
  ClockIcon,
  MusicalNoteIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

type SkeletonBlockProps = {
  className: string
}

function SkeletonBlock({ className }: SkeletonBlockProps) {
  return <div className={`rounded-2xl bg-white/8 ${className}`} />
}

function SectionIntroSkeleton({
  titleWidth = 'w-56 sm:w-72',
  bodyWidth = 'max-w-xl',
}: {
  titleWidth?: string
  bodyWidth?: string
}) {
  return (
    <div>
      <SkeletonBlock className={`h-6 ${titleWidth} sm:h-7`} />
      <SkeletonBlock className={`mt-1.5 h-4 w-full ${bodyWidth}`} />
    </div>
  )
}

function ProjectCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-purple-500/5 shadow-2xl shadow-purple-500/15 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-purple-500/20 bg-purple-500/10 px-4 py-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-purple-400" />
        </span>
        <div className="h-3 w-24 rounded-md bg-purple-400/25" />
      </div>
      <SkeletonBlock className="absolute right-4 top-13 size-8 rounded-xl" />
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3 pr-12">
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-5 w-2/5 rounded-lg sm:h-6" />
            <SkeletonBlock className="mt-2 h-3 w-24 rounded-md sm:h-3.5" />
          </div>
          <SkeletonBlock className="h-6 w-24 shrink-0 rounded-full" />
        </div>
        <SkeletonBlock className="mt-3 h-4 w-3/5 rounded-md" />
        <div className="mt-4 flex items-center gap-2">
          <SkeletonBlock className="h-5 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function FileListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-3 sm:gap-4 sm:px-4">
      <SkeletonBlock className="size-5 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-3.5 w-2/5 rounded-md" />
        <SkeletonBlock className="mt-1.5 h-3 w-20 rounded-md bg-white/5" />
      </div>
      <SkeletonBlock className="size-5 shrink-0 rounded-full" />
    </div>
  )
}

function CommentBubbleSkeleton() {
  return (
    <div className="flex gap-3 sm:gap-4">
      <SkeletonBlock className="size-8 shrink-0 rounded-full sm:size-10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-3.5 w-24 rounded-md" />
          <SkeletonBlock className="h-4 w-12 rounded" />
          <SkeletonBlock className="h-4 w-14 rounded" />
        </div>
        <SkeletonBlock className="mt-1.5 h-3.5 w-full rounded-md" />
        <SkeletonBlock className="mt-1 h-3.5 w-5/6 rounded-md" />
        <SkeletonBlock className="mt-1.5 h-3 w-28 rounded-md" />
      </div>
    </div>
  )
}

function ReviewComposerSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <SkeletonBlock className="h-19 w-full rounded-xl" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="size-4 rounded-full" />
              <SkeletonBlock className="h-8 w-20 rounded-lg" />
              <SkeletonBlock className="h-3 w-14 rounded-md" />
            </div>
            <SkeletonBlock className="ml-auto h-9 w-20 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ListenTrackRowSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-full flex-1 items-center gap-3 rounded-xl px-4 py-3">
        <SkeletonBlock className="size-4 shrink-0 rounded-full" />
        <SkeletonBlock className="h-3.5 min-w-0 flex-1 rounded-md" />
        <SkeletonBlock className="ml-auto h-4 w-6 shrink-0 rounded-full" />
      </div>
      <SkeletonBlock className="size-9 shrink-0 rounded-xl" />
    </div>
  )
}

function ListenCommentSkeleton({
  bodyLines = 1,
  showRole = false,
  showTimestampPill = false,
  showAttachment = false,
  repliesChip = false,
}: {
  bodyLines?: number
  showRole?: boolean
  showTimestampPill?: boolean
  showAttachment?: boolean
  repliesChip?: boolean
}) {
  const bodyWidths = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3']
  return (
    <div>
      <div className="flex gap-3 sm:gap-4">
        <SkeletonBlock className="size-8 shrink-0 rounded-full sm:size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBlock className="h-3.5 w-20 rounded-md" />
            {showRole && <SkeletonBlock className="h-4 w-12 rounded" />}
            {showTimestampPill && <SkeletonBlock className="h-4 w-14 rounded" />}
            <SkeletonBlock className="ml-auto h-3 w-10 rounded-md" />
          </div>
          {Array.from({ length: Math.max(1, bodyLines) }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className={`h-3.5 rounded-md ${bodyWidths[index % bodyWidths.length]} ${
                index === 0 ? 'mt-1.5' : 'mt-1'
              }`}
            />
          ))}
          {showAttachment && (
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pr-1 pl-2.5">
                <SkeletonBlock className="size-4 shrink-0 rounded" />
                <SkeletonBlock className="h-3 w-32 rounded-md" />
                <SkeletonBlock className="h-3 w-10 rounded-md" />
                <SkeletonBlock className="size-5 shrink-0 rounded-md" />
              </div>
            </div>
          )}
          <SkeletonBlock className="mt-1.5 h-3 w-12 rounded-md" />
        </div>
      </div>
      {repliesChip && (
        <div className="mt-3 ml-11 border-l border-white/10 pl-4 sm:ml-14 sm:pl-6">
          <SkeletonBlock className="h-3.5 w-20 rounded-md" />
        </div>
      )}
    </div>
  )
}

function ListenComposerPlaceholder() {
  return (
    <form aria-label="Comment composer (awaiting content)">
      <div className="rounded-xl border border-white/10 bg-white/2">
        <textarea
          placeholder="Add a mix note or feedback..."
          rows={2}
          aria-label="Comment body"
          className="w-full resize-none border-0 bg-transparent px-4 pt-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
        <div className="flex items-center gap-3 px-3 pt-2 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              aria-label="Capture timestamp"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClockIcon className="size-4" aria-hidden="true" />
            </button>
            <span className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              0:00
            </span>
            <span className="text-[10px] text-zinc-600">(optional)</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled
              aria-label="Attach files"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperClipIcon className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperAirplaneIcon className="size-4" aria-hidden="true" />
              Post
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function PaginationSkeleton() {
  return (
    <div className="mt-16 flex items-center justify-center gap-2">
      <SkeletonBlock className="size-9 rounded-xl" />
      <SkeletonBlock className="size-9 rounded-xl" />
      <SkeletonBlock className="size-9 rounded-xl" />
    </div>
  )
}

export function PortalDashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SkeletonBlock className="h-9 w-44 sm:h-10 sm:w-56" />
          <SkeletonBlock className="mt-2 h-4 w-64 max-w-sm sm:h-5 sm:w-80" />
        </div>
        <SkeletonBlock className="h-11 w-32 shrink-0 rounded-full" />
      </div>

      <div className="mt-8 grid gap-4 sm:mt-10">
        {[0, 1, 2].map((card) => (
          <ProjectCardSkeleton key={card} />
        ))}
      </div>

      <PaginationSkeleton />
    </div>
  )
}

function ProjectDetailHeaderScaffold({
  projectId,
  activeTab,
}: {
  projectId: string
  activeTab: 'upload' | 'listen'
}) {
  const uploadHref = projectId ? `/portal/${projectId}/upload` : '#'
  const listenHref = projectId ? `/portal/${projectId}/listen` : '#'

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-8 w-48 max-w-full animate-pulse rounded-xl sm:h-9 sm:w-64" />
        </div>
        <Link
          href="/portal"
          className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-white/5 px-4 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:text-white hover:ring-white/20 hover:shadow-md hover:shadow-violet-500/20 hover:scale-105"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="size-4"
          >
            <path
              fillRule="evenodd"
              d="M17.5 10a.75.75 0 0 1-.75.75H5.06l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 1 1 1.06 1.06L5.06 9.25h11.69a.75.75 0 0 1 .75.75Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden sm:inline">Back to Projects</span>
        </Link>
      </div>

      <div className="mt-4 sm:mt-6">
        <nav className="flex gap-1 rounded-2xl border border-white/10 bg-white/2 p-1.5 backdrop-blur-sm sm:gap-2 sm:p-2">
          <Link
            href={uploadHref}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm',
              activeTab === 'upload'
                ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <ArrowUpTrayIcon className="size-4 sm:size-5" />
            <span className="hidden sm:inline">Upload</span>
          </Link>
          <Link
            href={listenHref}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm',
              activeTab === 'listen'
                ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <MusicalNoteIcon className="size-4 sm:size-5" />
            <span className="hidden sm:inline">Listen</span>
          </Link>
        </nav>
      </div>
    </>
  )
}

export function ProjectDetailLoading() {
  const params = useParams()
  const pathname = usePathname() ?? ''
  const projectId =
    typeof params?.projectId === 'string' ? params.projectId : ''
  const activeTab: 'upload' | 'listen' = pathname.endsWith('/listen')
    ? 'listen'
    : 'upload'

  return (
    <div className="mx-auto max-w-4xl">
      <ProjectDetailHeaderScaffold
        projectId={projectId}
        activeTab={activeTab}
      />
      <div className="mt-6 sm:mt-8">
        {activeTab === 'listen' ? <ListenPageLoading /> : <UploadPageLoading />}
      </div>
    </div>
  )
}

function ProgressTimelineSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/2 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
      <div className="flex items-center">
        {[0, 1, 2, 3].map((step) => (
          <div
            key={step}
            className={`flex items-center${step < 3 ? ' flex-1' : ''}`}
          >
            <div className="flex flex-col items-center">
              <SkeletonBlock className="size-8 rounded-full sm:size-9" />
              <SkeletonBlock className="mt-2 h-3 w-12 rounded-md sm:h-3.5 sm:w-16" />
            </div>
            {step < 3 && (
              <div className="mx-2 mb-5 h-0.5 flex-1 rounded-full bg-white/5 sm:mx-3" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function UploadPageLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <SkeletonBlock className="h-6 w-40 rounded-md sm:h-7 sm:w-48" />
        <SkeletonBlock className="mt-1.5 h-4 w-72 max-w-full rounded-md bg-white/5 sm:w-96" />
      </div>

      <ProgressTimelineSkeleton />

      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-28 rounded-md" />
        <FileListRowSkeleton />
      </div>
    </div>
  )
}

export function ReviewPageLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <SectionIntroSkeleton titleWidth="w-52 sm:w-64" bodyWidth="max-w-md" />
      <div className="space-y-6">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-6">
          {[0, 1, 2].map((comment) => (
            <CommentBubbleSkeleton key={comment} />
          ))}
        </div>
        <ReviewComposerSkeleton />
      </div>
    </div>
  )
}

export function ListenPageLoading() {
  return (
    <div className="space-y-8">
      <div className="animate-pulse space-y-8">
        <div className="space-y-4">
          <div>
            <SkeletonBlock className="h-6 w-52 rounded-md sm:h-7 sm:w-64" />
            <SkeletonBlock className="mt-2 h-4 w-full max-w-md rounded-md" />
          </div>
          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm">
            <SkeletonBlock className="mb-3 h-3 w-14 rounded-md" />
            <ListenTrackRowSkeleton />
            <ListenTrackRowSkeleton />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SkeletonBlock className="h-6 w-56 rounded-md sm:h-7 sm:w-72" />
                <SkeletonBlock className="h-5 w-48 rounded-full" />
              </div>
              <SkeletonBlock className="size-9 shrink-0 rounded-full" />
            </div>
            <SkeletonBlock className="mt-2 h-4 w-72 max-w-md rounded-md" />
          </div>

          <div className="space-y-6">
            <ListenCommentSkeleton
              bodyLines={1}
              showAttachment
              repliesChip
            />
            <ListenCommentSkeleton
              bodyLines={1}
              showRole
              showAttachment
            />
            <ListenCommentSkeleton bodyLines={1} showRole />
            <ListenCommentSkeleton
              bodyLines={1}
              showTimestampPill
            />
          </div>
        </div>
      </div>

      <ListenComposerPlaceholder />
    </div>
  )
}

