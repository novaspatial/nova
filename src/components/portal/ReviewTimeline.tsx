'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectComment } from '@/types/portal'
import {
  ArrowUturnLeftIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAudioPlayer } from '@/components/audio/AudioProvider'

const COLLAPSE_REPLY_THRESHOLD = 3

function formatTimestamp(ms: number | null): string {
  if (ms === null) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function parseTimestamp(input: string): number | null {
  const match = input.match(/^(\d+):(\d{1,2})$/)
  if (!match) return null
  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  if (seconds >= 60) return null
  return (minutes * 60 + seconds) * 1000
}

function formatRelativeTime(iso: string): string {
  const created = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((Date.now() - created) / 1000))
  if (diffSec < 45) return 'just now'
  if (diffSec < 3600) return `${Math.max(1, Math.round(diffSec / 60))}m ago`
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.round(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function groupIntoThreads(
  comments: ProjectComment[],
): Array<{ parent: ProjectComment; replies: ProjectComment[] }> {
  const byId = new Map(
    comments.map((comment) => [comment.id, comment] as const),
  )
  const topLevelIdOf = (comment: ProjectComment): string => {
    let current = comment
    while (current.parent_id && byId.has(current.parent_id)) {
      current = byId.get(current.parent_id)!
    }
    return current.id
  }

  const parents: ProjectComment[] = []
  const repliesByTopLevel = new Map<string, ProjectComment[]>()
  for (const comment of comments) {
    if (!comment.parent_id) {
      parents.push(comment)
    } else {
      const topId = topLevelIdOf(comment)
      const arr = repliesByTopLevel.get(topId) ?? []
      arr.push(comment)
      repliesByTopLevel.set(topId, arr)
    }
  }

  return parents.map((parent) => ({
    parent,
    replies: repliesByTopLevel.get(parent.id) ?? [],
  }))
}

function CommentBubble({
  comment,
  onSeek,
  onReply,
}: {
  comment: ProjectComment
  onSeek?: (ms: number) => void
  onReply?: () => void
}) {
  const isStudio = comment.author?.role === 'studio'
  const initial = (comment.author?.display_name?.[0] || '?').toUpperCase()
  const authorName = comment.author?.display_name || 'Anonymous'

  return (
    <div className="flex gap-3 sm:gap-4" data-comment-id={comment.id}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:size-10 sm:text-sm ${
          isStudio
            ? 'border-2 border-violet-500/30 bg-violet-500/10 text-violet-400'
            : 'border-2 border-white/10 bg-white/5 text-zinc-400'
        }`}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white">{authorName}</span>
          {isStudio && (
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
              STUDIO
            </span>
          )}
          {comment.timestamp_ms !== null && (
            <button
              type="button"
              onClick={() => onSeek?.(comment.timestamp_ms!)}
              aria-label={`Seek to ${formatTimestamp(comment.timestamp_ms)}`}
              className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 transition hover:bg-violet-500/10 hover:text-violet-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
            >
              <ClockIcon className="size-3" />
              {formatTimestamp(comment.timestamp_ms)}
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-300">{comment.body}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-600">
          <span>{formatRelativeTime(comment.created_at)}</span>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              aria-label={`Reply to ${authorName}`}
              className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-violet-300 focus:outline-none focus-visible:text-violet-300"
            >
              <ArrowUturnLeftIcon className="size-3" />
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ReplyComposer({
  onSubmit,
  onCancel,
  authorName,
}: {
  onSubmit: (body: string) => Promise<void>
  onCancel: () => void
  authorName: string
}) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!body.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(body.trim())
      setBody('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={`Reply to ${authorName}...`}
        rows={2}
        aria-label={`Reply to ${authorName}`}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:text-white focus:outline-none focus-visible:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 focus:outline-none focus-visible:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PaperAirplaneIcon className="size-3.5" />
          {submitting ? 'Posting...' : 'Reply'}
        </button>
      </div>
    </form>
  )
}

function CommentThread({
  parent,
  replies,
  onSeek,
  onReply,
  forceExpanded = false,
}: {
  parent: ProjectComment
  replies: ProjectComment[]
  onSeek: (ms: number) => void
  onReply: (parentId: string, body: string) => Promise<void>
  forceExpanded?: boolean
}) {
  const hasReplies = replies.length > 0
  const [expanded, setExpanded] = useState(
    hasReplies && replies.length < COLLAPSE_REPLY_THRESHOLD,
  )
  const [replyOpen, setReplyOpen] = useState(false)
  const effectiveExpanded = forceExpanded || expanded

  const repliesId = `thread-replies-${parent.id}`
  const replyCountLabel =
    replies.length === 1 ? '1 reply' : `${replies.length} replies`

  const handleOpenReply = useCallback(() => {
    setReplyOpen(true)
    if (hasReplies) setExpanded(true)
  }, [hasReplies])

  return (
    <div className="space-y-3">
      <CommentBubble
        comment={parent}
        onSeek={onSeek}
        onReply={handleOpenReply}
      />

      {hasReplies && (
        <div className="ml-11 border-l border-white/10 pl-4 sm:ml-14 sm:pl-6">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={effectiveExpanded}
            aria-controls={repliesId}
            disabled={forceExpanded}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-violet-300 focus:outline-none focus-visible:text-violet-300 disabled:opacity-60"
          >
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${effectiveExpanded ? '' : '-rotate-90'}`}
              aria-hidden="true"
            />
            {effectiveExpanded ? `Hide ${replyCountLabel}` : replyCountLabel}
          </button>
          {effectiveExpanded && (
            <div id={repliesId} className="mt-4 space-y-4">
              {replies.map((reply) => (
                <CommentBubble
                  key={reply.id}
                  comment={reply}
                  onSeek={onSeek}
                  onReply={handleOpenReply}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {replyOpen && (
        <div className="ml-11 sm:ml-14">
          <ReplyComposer
            authorName={parent.author?.display_name || 'Anonymous'}
            onCancel={() => setReplyOpen(false)}
            onSubmit={async (replyBody) => {
              await onReply(parent.id, replyBody)
              setReplyOpen(false)
              setExpanded(true)
            }}
          />
        </div>
      )}
    </div>
  )
}

export function ReviewTimeline({
  projectId,
  initialComments,
}: {
  projectId: string
  initialComments: ProjectComment[]
}) {
  const router = useRouter()
  const player = useAudioPlayer()
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')
  const [timestampInput, setTimestampInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollRequest, setScrollRequest] = useState<
    { kind: 'bottom' } | { kind: 'comment'; id: string } | null
  >(null)

  useEffect(() => {
    setComments((currentComments) => {
      const optimisticComments = currentComments.filter(
        (currentComment) =>
          !initialComments.some(
            (serverComment) => serverComment.id === currentComment.id,
          ),
      )

      return [...initialComments, ...optimisticComments]
    })
  }, [initialComments])

  const threads = useMemo(() => groupIntoThreads(comments), [comments])

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = searchOpen && trimmedQuery.length > 0

  const visibleThreads = useMemo(() => {
    if (!isSearching) return threads
    return threads
      .map(({ parent, replies }) => {
        const parentMatches = parent.body.toLowerCase().includes(trimmedQuery)
        const matchedReplies = replies.filter((reply) =>
          reply.body.toLowerCase().includes(trimmedQuery),
        )
        if (parentMatches) return { parent, replies }
        if (matchedReplies.length > 0)
          return { parent, replies: matchedReplies }
        return null
      })
      .filter(
        (
          thread,
        ): thread is { parent: ProjectComment; replies: ProjectComment[] } =>
          thread !== null,
      )
  }, [threads, isSearching, trimmedQuery])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (!scrollRequest) return
    const container = scrollContainerRef.current
    if (!container) {
      setScrollRequest(null)
      return
    }

    if (scrollRequest.kind === 'bottom') {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      const target = container.querySelector<HTMLElement>(
        `[data-comment-id="${scrollRequest.id}"]`,
      )
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }

    setScrollRequest(null)
  }, [scrollRequest, comments])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  const handleSeek = useCallback(
    (ms: number) => {
      player.seek(ms / 1000)
    },
    [player],
  )

  const postComment = useCallback(
    async (payload: {
      body: string
      timestampMs: number | null
      parentId?: string
    }): Promise<ProjectComment> => {
      const res = await fetch(`/api/portal/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      return (await res.json()) as ProjectComment
    },
    [projectId],
  )

  const handleReply = useCallback(
    async (parentId: string, replyBody: string) => {
      try {
        const newComment = await postComment({
          body: replyBody,
          timestampMs: null,
          parentId,
        })
        setComments((prev) => [...prev, newComment])
        setScrollRequest({ kind: 'comment', id: newComment.id })
        router.refresh()
      } catch {
        // Error handled silently — could add toast notification
      }
    },
    [postComment, router],
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!body.trim() || submitting) return

      setSubmitting(true)

      const timestampMs = parseTimestamp(timestampInput)

      try {
        const newComment = await postComment({
          body: body.trim(),
          timestampMs,
        })
        setComments((prev) => [...prev, newComment])
        setBody('')
        setTimestampInput('')
        setScrollRequest({ kind: 'bottom' })
        router.refresh()
      } catch {
        // Error handled silently — could add toast notification
      } finally {
        setSubmitting(false)
      }
    },
    [body, timestampInput, postComment, router, submitting],
  )

  const hasAnyComments = threads.length > 0

  return (
    <div data-listen-comments className="space-y-6">
      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            Timestamped Revisions
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Drop precise mix notes directly on the track timeline.
          </p>
        </div>
        <div className="order-last w-full sm:order-0 sm:w-auto sm:shrink-0">
          {!searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search comments"
              aria-expanded={false}
              disabled={!hasAnyComments}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-violet-500/40 hover:text-violet-300 focus:outline-none focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:text-zinc-400"
            >
              <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <div className="relative flex w-full items-center sm:w-64">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  }
                }}
                placeholder="Search comments..."
                aria-label="Search comments"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pr-9 pl-9 text-sm text-white transition outline-none placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:bg-white/5 focus-visible:text-white"
              >
                <XMarkIcon className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments list — fixed height, internal scroll */}
      <div className="h-[clamp(20rem,60vh,32rem)] rounded-2xl border border-white/10 bg-white/2 backdrop-blur-sm">
        {hasAnyComments ? (
          visibleThreads.length > 0 ? (
            <div
              ref={scrollContainerRef}
              className="nova-scrollbar h-full space-y-6 overflow-y-auto p-4 sm:p-6"
            >
              {visibleThreads.map(({ parent, replies }) => (
                <CommentThread
                  key={parent.id}
                  parent={parent}
                  replies={replies}
                  onSeek={handleSeek}
                  onReply={handleReply}
                  forceExpanded={isSearching}
                />
              ))}
            </div>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="flex h-full flex-col items-center justify-center px-6 text-center"
            >
              <MagnifyingGlassIcon
                className="size-10 text-zinc-600"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-zinc-400">
                No comments matching &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            </div>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <ChatBubbleLeftRightIcon className="size-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              No comments yet. Add your first timestamped note below.
            </p>
          </div>
        )}
      </div>

      {/* New comment form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-3">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add a mix note or feedback..."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 text-zinc-500" />
                <input
                  type="text"
                  value={timestampInput}
                  onChange={(event) => setTimestampInput(event.target.value)}
                  placeholder="0:00"
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
                />
                <span className="text-xs text-zinc-500">(optional)</span>
              </div>
              <button
                type="submit"
                disabled={!body.trim() || submitting}
                className="ml-auto flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PaperAirplaneIcon className="size-4" />
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
