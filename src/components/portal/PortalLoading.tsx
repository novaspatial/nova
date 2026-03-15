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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/2 shadow-2xl shadow-violet-500/5 backdrop-blur-sm">
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-3 pr-12">
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-5 w-3/5 rounded-lg" />
            <SkeletonBlock className="mt-1.5 h-3.5 w-24 rounded-md" />
          </div>
          <SkeletonBlock className="h-6 w-20 shrink-0 rounded-full" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <SkeletonBlock className="size-4 rounded-full" />
          <SkeletonBlock className="h-3 w-20 rounded-md" />
          <SkeletonBlock className="h-3 w-32 rounded-md" />
        </div>
        <SkeletonBlock className="mt-3 h-4 w-full rounded-md" />
        <div className="mt-4 flex items-center gap-2">
          <SkeletonBlock className="h-5 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}

function StepNavigationSkeleton() {
  return (
    <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/2 p-1.5 backdrop-blur-sm sm:gap-2 sm:p-2">
      {[0, 1, 2, 3].map((step) => (
        <div
          key={step}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 sm:gap-2 sm:px-4 sm:py-3"
        >
          <SkeletonBlock className="size-4 rounded-full sm:size-5" />
          <SkeletonBlock className="hidden h-4 w-12 rounded-md sm:block" />
        </div>
      ))}
    </div>
  )
}

function FileListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-3 sm:gap-4 sm:px-4">
      <SkeletonBlock className="size-5 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-3.5 w-2/5 rounded-md" />
        <div className="mt-1.5 flex items-center gap-1.5">
          <SkeletonBlock className="h-3 w-12 rounded-md" />
          <SkeletonBlock className="h-3 w-10 rounded-md" />
        </div>
      </div>
      <SkeletonBlock className="size-7 shrink-0 rounded-lg" />
    </div>
  )
}

function UploadDropzoneSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/2 px-4 py-8 text-center sm:py-12">
      <div className="mx-auto size-8 rounded-full bg-white/8 sm:size-10" />
      <SkeletonBlock className="mx-auto mt-3 h-4 w-52 rounded-md sm:w-64" />
      <SkeletonBlock className="mx-auto mt-2 h-3 w-40 rounded-md sm:w-48" />
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

function ListenTracksSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-3 w-52 rounded-md" />
      <div className="space-y-1 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm">
        <SkeletonBlock className="mb-3 h-3 w-14 rounded-md" />
        {[0, 1, 2].map((track) => (
          <div
            key={track}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
          >
            <SkeletonBlock className="size-4 rounded-full" />
            <SkeletonBlock className="h-3.5 w-2/5 rounded-md" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="h-3 w-44 rounded-md" />
    </div>
  )
}

function DeliverableCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 sm:size-12">
        <SkeletonBlock className="size-5 rounded-md sm:size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-4 w-2/5 rounded-md" />
        <div className="mt-1.5 flex items-center gap-2">
          <SkeletonBlock className="h-4 w-16 rounded" />
          <SkeletonBlock className="h-3 w-12 rounded-md" />
          <SkeletonBlock className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <SkeletonBlock className="h-9 w-24 rounded-xl" />
    </div>
  )
}

function PaginationSkeleton() {
  return (
    <div className="mt-16 flex items-center justify-center gap-2">
      <SkeletonBlock className="size-9 rounded-xl" />
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
        <SkeletonBlock className="hidden h-11 w-32 shrink-0 rounded-full sm:block" />
      </div>

      <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <ProjectCardSkeleton key={card} />
        ))}
      </div>

      <PaginationSkeleton />
    </div>
  )
}

export function ProjectDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SkeletonBlock className="h-8 w-2/3 max-w-md sm:h-9" />
        <SkeletonBlock className="h-9 w-40 shrink-0 self-start rounded-full" />
      </div>

      <div className="mt-4 sm:mt-6">
        <StepNavigationSkeleton />
      </div>

      <div className="mt-6 space-y-6 sm:mt-8">
        <SectionIntroSkeleton bodyWidth="max-w-lg" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
    </div>
  )
}

export function UploadPageLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <SectionIntroSkeleton titleWidth="w-40 sm:w-48" bodyWidth="max-w-md" />
      <div className="space-y-8">
        {/* Client stems section */}
        <div className="space-y-4">
          <SkeletonBlock className="h-4 w-40 rounded-md" />
          <FileListRowSkeleton />
          <FileListRowSkeleton />
          <UploadDropzoneSkeleton />
          <SkeletonBlock className="mx-auto h-12 w-full rounded-xl sm:w-44" />
        </div>

        {/* Studio mixes section */}
        <div className="space-y-4 border-t border-white/10 pt-6">
          <div>
            <SkeletonBlock className="h-4 w-24 rounded-md" />
            <SkeletonBlock className="mt-1.5 h-3 w-56 rounded-md" />
          </div>
          <SkeletonBlock className="h-4 w-28 rounded-md" />
          <FileListRowSkeleton />
          <UploadDropzoneSkeleton />
        </div>
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
    <div className="animate-pulse space-y-6">
      <SectionIntroSkeleton titleWidth="w-44 sm:w-56" bodyWidth="max-w-md" />
      <ListenTracksSkeleton />
    </div>
  )
}

export function DeliverPageLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <SectionIntroSkeleton titleWidth="w-52 sm:w-64" bodyWidth="max-w-2xl" />

      {/* Deliverable cards */}
      <div className="space-y-3">
        <DeliverableCardSkeleton />
        <DeliverableCardSkeleton />
      </div>

      {/* Studio upload section */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        <div>
          <SkeletonBlock className="h-4 w-36 rounded-md" />
          <SkeletonBlock className="mt-1.5 h-3 w-64 rounded-md" />
        </div>
        <div className="space-y-4">
          <div>
            <SkeletonBlock className="mb-2 h-3 w-28 rounded-md" />
            <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <SkeletonBlock className="h-7 w-16 rounded-lg" />
              <SkeletonBlock className="h-7 w-20 rounded-lg" />
              <SkeletonBlock className="h-7 w-24 rounded-lg" />
            </div>
          </div>
          <UploadDropzoneSkeleton />
        </div>
      </div>

      {/* Approval banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <SkeletonBlock className="h-4 w-32 rounded-md" />
            <SkeletonBlock className="mt-1.5 h-3 w-64 rounded-md" />
          </div>
          <SkeletonBlock className="h-9 w-28 shrink-0 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
