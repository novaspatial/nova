'use client'

// Comment/review surface for a mix. Threads top-level comments with replies
// and lets the author anchor a comment to either a single timestamp or a
// waveform range (anchorAMs/anchorBMs from AudioProvider). Attachments are
// uploaded optimistically: the UI shows a local "pending" row while the
// `/comment-attachments/register` endpoint exchanges a signed upload URL,
// then the row is replaced by the server-backed record once the comment is
// posted. Parent deletion is blocked while replies exist — the DELETE route
// surfaces that as 409 and we show it as an inline error rather than
// removing the comment optimistically.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ProjectComment,
  ProjectCommentAttachment,
  UserRole,
} from '@/types/portal'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAudioPlayer } from '@/components/audio/AudioProvider'
import { useWaveformBinding } from '@/components/audio/player/useWaveformBinding'
import { formatTrackTime, Waveform } from '@/components/audio/player/Waveform'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import { useCommentClock } from '@/components/portal/useCommentClock'
import { formatFileSize } from '@/lib/formatFileSize'
import { runUploadDance } from '@/lib/portal/uploadRunner'

const COLLAPSE_REPLY_THRESHOLD = 3

type PendingAttachmentStatus = 'uploading' | 'uploaded' | 'failed'

interface PendingAttachment {
  id: string
  file: File
  previewUrl: string | null
  status: PendingAttachmentStatus
  progress: number
  storagePath?: string
  error?: string
}

function createPendingAttachment(file: File): PendingAttachment {
  const isImage = file.type.startsWith('image/')
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    status: 'uploading',
    progress: 0,
  }
}

function CommentAttachmentList({
  attachments,
  className,
}: {
  attachments: ProjectCommentAttachment[]
  className?: string
}) {
  if (attachments.length === 0) return null
  return (
    <ul
      role="list"
      className={`flex flex-wrap gap-2 ${className ?? ''}`.trim()}
    >
      {attachments.map((attachment) => {
        const label = `${attachment.file_name}, ${formatFileSize(attachment.file_size)}`
        const isImage = attachment.mime_type.startsWith('image/')
        const viewHref = attachment.view_url ?? undefined
        const downloadHref =
          attachment.download_url ?? attachment.view_url ?? undefined
        if (isImage && viewHref) {
          return (
            <li key={attachment.id} className="group relative">
              <a
                href={viewHref}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${label} in a new tab`}
                className="block overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-violet-500/40 focus:outline-none focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/50"
              >
                {/* next/image is unsuitable for short-lived signed storage URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewHref}
                  alt={attachment.file_name}
                  className="size-20 object-cover"
                />
              </a>
              {downloadHref && (
                <a
                  href={downloadHref}
                  aria-label={`Download ${attachment.file_name}`}
                  className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 backdrop-blur-sm transition group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-violet-600 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                >
                  <ArrowDownTrayIcon className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </li>
          )
        }
        return (
          <li key={attachment.id}>
            <div
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pr-1 pl-2.5 text-xs text-zinc-300"
              aria-label={label}
            >
              <DocumentIcon
                className="size-4 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <span className="max-w-40 truncate">{attachment.file_name}</span>
              <span className="shrink-0 text-zinc-500">
                {formatFileSize(attachment.file_size)}
              </span>
              {downloadHref && (
                <a
                  href={downloadHref}
                  aria-label={`Download ${attachment.file_name}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:bg-white/10 focus-visible:text-white"
                >
                  <ArrowDownTrayIcon className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function formatTimestamp(ms: number | null): string {
  if (ms === null) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function ComposerWaveform({
  selectedTrackId,
  onAnchorBDrag,
}: {
  selectedTrackId: string | null
  onAnchorBDrag?: () => void
}) {
  const { player, waveformProps, elapsedSeconds, hasDuration } =
    useWaveformBinding()

  const trackLoadedHere =
    !!player.mixedMusicFile &&
    selectedTrackId != null &&
    String(player.mixedMusicFile.id) === selectedTrackId

  const composerWaveformProps = onAnchorBDrag
    ? {
        ...waveformProps,
        onDragAnchor: (which: 'a' | 'b', seconds: number) => {
          if (which === 'b') onAnchorBDrag()
          waveformProps.onDragAnchor(which, seconds)
        },
      }
    : waveformProps

  return (
    <div>
      {trackLoadedHere ? (
        <div className="flex items-center gap-3">
          <span
            className={`w-12 shrink-0 text-right font-mono text-xs text-zinc-500 tabular-nums ${
              hasDuration ? '' : 'opacity-0'
            }`}
          >
            {formatTrackTime(elapsedSeconds, player.duration)}
          </span>
          <Waveform
            {...composerWaveformProps}
            height={96}
            barWidth={3}
            barGap={2}
            barMinHeight={3}
          />
          <span
            className={`w-12 shrink-0 text-left font-mono text-xs text-zinc-500 tabular-nums ${
              hasDuration ? '' : 'opacity-0'
            }`}
          >
            {formatTrackTime(player.duration, player.duration)}
          </span>
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-zinc-500">
          Play the selected track to see the waveform and mark timestamps.
        </p>
      )}
    </div>
  )
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
  onDelete,
}: {
  comment: ProjectComment
  onSeek?: (ms: number) => void
  onReply?: () => void
  onDelete?: () => void
}) {
  const isStudio = comment.author?.role === 'studio'
  const initial = (comment.author?.display_name?.[0] || '?').toUpperCase()
  const authorName = comment.author?.display_name || 'Anonymous'
  const attachments = comment.attachments ?? []
  const body = comment.body?.trim() ?? ''

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
              {comment.timestamp_end_ms !== null
                ? `${formatTimestamp(comment.timestamp_ms)} – ${formatTimestamp(comment.timestamp_end_ms)}`
                : formatTimestamp(comment.timestamp_ms)}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600">
            <span>{formatRelativeTime(comment.created_at)}</span>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete comment by ${authorName}`}
                className="inline-flex items-center justify-center text-zinc-500 transition hover:text-rose-300 focus:outline-none focus-visible:text-rose-300"
              >
                <TrashIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {body.length > 0 && (
          <p className="mt-1 text-sm text-zinc-300">{body}</p>
        )}
        {attachments.length > 0 && (
          <CommentAttachmentList attachments={attachments} className="mt-2" />
        )}
        {onReply && (
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-600">
            <button
              type="button"
              onClick={onReply}
              aria-label={`Reply to ${authorName}`}
              className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-violet-300 focus:outline-none focus-visible:text-violet-300"
            >
              <ArrowUturnLeftIcon className="size-3" />
              Reply
            </button>
          </div>
        )}
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
  onDelete,
  canDelete,
  forceExpanded = false,
}: {
  parent: ProjectComment
  replies: ProjectComment[]
  onSeek: (ms: number) => void
  onReply: (parentId: string, body: string) => Promise<void>
  onDelete: (comment: ProjectComment) => void
  canDelete: (comment: ProjectComment) => boolean
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

  // parent_id FK has no cascade, so replies must be removed before their parent.
  const parentDeletable = canDelete(parent) && !hasReplies

  return (
    <div className="space-y-3">
      <CommentBubble
        comment={parent}
        onSeek={onSeek}
        onReply={handleOpenReply}
        onDelete={parentDeletable ? () => onDelete(parent) : undefined}
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
                  onDelete={
                    canDelete(reply) ? () => onDelete(reply) : undefined
                  }
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
  comments,
  onCommentsChange,
  selectedTrackId,
  selectedTrackName,
  currentUserId,
  currentRole,
}: {
  projectId: string
  comments: ProjectComment[]
  onCommentsChange: (
    updater: (prev: ProjectComment[]) => ProjectComment[],
  ) => void
  selectedTrackId: string | null
  selectedTrackName: string | null
  currentUserId: string | null
  currentRole: UserRole | null
}) {
  const router = useRouter()
  const player = useAudioPlayer()
  const clock = useCommentClock(player, selectedTrackId)
  const setComments = onCommentsChange
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([])
  const [deleteTarget, setDeleteTarget] = useState<ProjectComment | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollRequest, setScrollRequest] = useState<
    { kind: 'bottom' } | { kind: 'comment'; id: string } | null
  >(null)

  useEffect(() => {
    const urls = previewUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const uploadPendingAttachment = useCallback(
    async (attachment: PendingAttachment) => {
      try {
        const { storagePath } = await runUploadDance({
          projectId,
          file: attachment.file,
          kind: 'comment_attachment',
          onProgress: (progress) => {
            setPendingAttachments((prev) =>
              prev.map((entry) =>
                entry.id === attachment.id ? { ...entry, progress } : entry,
              ),
            )
          },
        })

        setPendingAttachments((prev) =>
          prev.map((entry) =>
            entry.id === attachment.id
              ? {
                  ...entry,
                  status: 'uploaded',
                  progress: 100,
                  storagePath,
                }
              : entry,
          ),
        )
      } catch (err) {
        setPendingAttachments((prev) =>
          prev.map((entry) =>
            entry.id === attachment.id
              ? {
                  ...entry,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : entry,
          ),
        )
      }
    },
    [projectId],
  )

  const handleFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (selected.length === 0) return
      const next = selected.map((file) => {
        const pending = createPendingAttachment(file)
        if (pending.previewUrl) {
          previewUrlsRef.current.add(pending.previewUrl)
        }
        return pending
      })
      setPendingAttachments((prev) => [...prev, ...next])
      next.forEach((pending) => {
        void uploadPendingAttachment(pending)
      })
    },
    [uploadPendingAttachment],
  )

  const handleRemoveAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === id)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
        previewUrlsRef.current.delete(target.previewUrl)
      }
      return prev.filter((attachment) => attachment.id !== id)
    })
  }, [])

  const handleRetryAttachment = useCallback(
    (id: string) => {
      setPendingAttachments((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: 'uploading',
                progress: 0,
                error: undefined,
              }
            : entry,
        ),
      )
      const target = pendingAttachments.find((entry) => entry.id === id)
      if (target) {
        void uploadPendingAttachment({
          ...target,
          status: 'uploading',
          progress: 0,
          error: undefined,
        })
      }
    },
    [pendingAttachments, uploadPendingAttachment],
  )

  const threads = useMemo(() => groupIntoThreads(comments), [comments])

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const isSearching = searchOpen && trimmedQuery.length > 0

  const visibleThreads = useMemo(() => {
    if (!isSearching) return threads
    return threads
      .map(({ parent, replies }) => {
        const parentMatches = (parent.body ?? '')
          .toLowerCase()
          .includes(trimmedQuery)
        const matchedReplies = replies.filter((reply) =>
          (reply.body ?? '').toLowerCase().includes(trimmedQuery),
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
      timestampEndMs?: number | null
      trackId: string
      parentId?: string
      attachments?: Array<{
        storagePath: string
        fileName: string
        fileSize: number
        mimeType: string
      }>
    }): Promise<ProjectComment> => {
      const res = await fetch(`/api/portal/projects/${projectId}/listen`, {
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
      if (!selectedTrackId) return
      try {
        const newComment = await postComment({
          body: replyBody,
          timestampMs: null,
          trackId: selectedTrackId,
          parentId,
        })
        setComments((prev) => [...prev, newComment])
        setScrollRequest({ kind: 'comment', id: newComment.id })
        router.refresh()
      } catch {
        // Error handled silently — could add toast notification
      }
    },
    [postComment, router, selectedTrackId, setComments],
  )

  const canDelete = useCallback(
    (comment: ProjectComment) => {
      if (currentRole === 'studio') return true
      return Boolean(currentUserId) && comment.author_id === currentUserId
    },
    [currentRole, currentUserId],
  )

  const handleDeleteRequest = useCallback((comment: ProjectComment) => {
    setDeleteTarget(comment)
    setDeleteError(null)
  }, [])

  const handleDeleteCancel = useCallback(() => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [isDeleting])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/comments/${deleteTarget.id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error || 'Failed to delete comment')
      }
      setComments((prev) =>
        prev.filter((comment) => comment.id !== deleteTarget.id),
      )
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete comment',
      )
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, projectId, router, setComments])

  const uploadedAttachments = pendingAttachments.filter(
    (attachment) => attachment.status === 'uploaded',
  )
  const hasUploading = pendingAttachments.some(
    (attachment) => attachment.status === 'uploading',
  )
  const canPost =
    !submitting &&
    !hasUploading &&
    selectedTrackId !== null &&
    (body.trim().length > 0 || uploadedAttachments.length > 0)

  const selection = player.selection
  const clockAriaLabel =
    clock.state === 'off'
      ? 'Arm timestamp capture'
      : clock.state === 'armed'
        ? 'Cancel timestamp capture'
        : clock.state === 'live'
          ? 'Lock timestamp range'
          : 'Clear timestamp range'
  const clockTitle =
    clock.state === 'off'
      ? 'Click to arm, then type to mark the start. Click again to lock the end. Drag the waveform handles to fine-tune.'
      : clock.state === 'armed'
        ? 'Start typing to mark the start. Click to cancel.'
        : clock.state === 'live'
          ? 'Click to lock the end of the range.'
          : 'Click to clear the timestamp range.'

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (submitting || hasUploading || !selectedTrackId) return
      const trimmedBody = body.trim()
      if (trimmedBody.length === 0 && uploadedAttachments.length === 0) return

      setSubmitting(true)

      const currentSelection = player.selection
      const timestampMs = currentSelection?.startMs ?? null
      const timestampEndMs =
        currentSelection?.anchorBMs != null
          ? (currentSelection.endMs ?? null)
          : null

      try {
        const newComment = await postComment({
          body: trimmedBody,
          timestampMs,
          timestampEndMs,
          trackId: selectedTrackId,
          attachments: uploadedAttachments.map((attachment) => ({
            storagePath: attachment.storagePath!,
            fileName: attachment.file.name,
            fileSize: attachment.file.size,
            mimeType: attachment.file.type || 'application/octet-stream',
          })),
        })
        setComments((prev) => [...prev, newComment])
        setPendingAttachments((prev) => {
          prev.forEach((entry) => {
            if (entry.previewUrl) {
              URL.revokeObjectURL(entry.previewUrl)
              previewUrlsRef.current.delete(entry.previewUrl)
            }
          })
          return []
        })
        setBody('')
        clock.clear()
        setScrollRequest({ kind: 'bottom' })
        router.refresh()
      } catch {
        // Error handled silently — could add toast notification
      } finally {
        setSubmitting(false)
      }
    },
    [
      body,
      clock,
      hasUploading,
      player,
      postComment,
      router,
      selectedTrackId,
      setComments,
      submitting,
      uploadedAttachments,
    ],
  )

  const hasAnyComments = threads.length > 0
  const [sectionOpen, setSectionOpen] = useState(true)

  return (
    <div data-listen-comments className="space-y-6">
      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          aria-expanded={sectionOpen}
          className="flex w-full min-w-0 flex-1 items-start rounded-lg text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Timestamped Revisions
              </h2>
              {selectedTrackName && (
                <span
                  className="inline-flex max-w-full items-center truncate rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300"
                  aria-label={`Viewing comments for ${selectedTrackName}`}
                >
                  {selectedTrackName}
                </span>
              )}
            </div>
          </div>
        </button>
        {sectionOpen && (
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
        )}
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          aria-expanded={sectionOpen}
          aria-label={sectionOpen ? 'Collapse comments' : 'Expand comments'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-400 transition-colors duration-150 hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-violet-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
        >
          <ChevronDownIcon
            className={`size-4 transition-transform duration-200 ${sectionOpen ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {sectionOpen && (
        <>
          {/* Composer waveform — mirrors the dock so users can mark timestamps without looking away */}
          <ComposerWaveform
            selectedTrackId={selectedTrackId}
            onAnchorBDrag={clock.handleAnchorBDrag}
          />

          {/* New comment form */}
          <form onSubmit={handleSubmit}>
            <div className="rounded-xl border border-white/10 bg-white/2 transition focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/50">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={clock.handleComposerKeyDown}
                placeholder="Add a mix note or feedback..."
                rows={2}
                className="w-full resize-none border-0 bg-transparent px-4 pt-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              {pendingAttachments.length > 0 && (
                <ul
                  role="list"
                  aria-label="Pending attachments"
                  className="flex flex-wrap gap-2 px-3 pt-1"
                >
                  {pendingAttachments.map((attachment) => {
                    const statusLabel =
                      attachment.status === 'uploading'
                        ? `Uploading ${attachment.progress}%`
                        : attachment.status === 'failed'
                          ? `Upload failed${attachment.error ? `: ${attachment.error}` : ''}`
                          : 'Uploaded'
                    return (
                      <li key={attachment.id}>
                        <div
                          className={`group flex items-center gap-2 rounded-lg border py-1.5 pr-1 pl-2 text-xs text-zinc-300 ${
                            attachment.status === 'failed'
                              ? 'border-rose-500/30 bg-rose-500/5'
                              : 'border-white/10 bg-white/5'
                          }`}
                          aria-label={`${attachment.file.name}, ${formatFileSize(attachment.file.size)}, ${statusLabel}`}
                        >
                          {attachment.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={attachment.previewUrl}
                              alt=""
                              aria-hidden="true"
                              className="size-6 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <DocumentIcon
                              className="size-4 shrink-0 text-zinc-400"
                              aria-hidden="true"
                            />
                          )}
                          <span className="max-w-40 truncate">
                            {attachment.file.name}
                          </span>
                          <span className="shrink-0 text-zinc-500">
                            {formatFileSize(attachment.file.size)}
                          </span>
                          {attachment.status === 'uploading' && (
                            <span className="shrink-0 font-mono text-[10px] text-violet-300">
                              {attachment.progress}%
                            </span>
                          )}
                          {attachment.status === 'failed' && (
                            <>
                              <ExclamationCircleIcon
                                className="size-4 shrink-0 text-rose-400"
                                aria-hidden="true"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleRetryAttachment(attachment.id)
                                }
                                aria-label={`Retry upload of ${attachment.file.name}`}
                                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:bg-white/10 focus-visible:text-white"
                              >
                                <ArrowPathIcon
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAttachment(attachment.id)
                            }
                            aria-label={`Remove ${attachment.file.name}`}
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:bg-white/10 focus-visible:text-white"
                          >
                            <XMarkIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="flex items-center gap-3 px-3 pt-2 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clock.toggle}
                    disabled={clock.disabled}
                    aria-label={clockAriaLabel}
                    aria-pressed={clock.state !== 'off'}
                    title={clockTitle}
                    className={`inline-flex size-9 items-center justify-center rounded-xl border transition focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      clock.state === 'off'
                        ? 'border-white/10 bg-white/5 text-zinc-400 hover:border-violet-500/40 hover:text-violet-300'
                        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    <ClockIcon
                      className={`size-4 ${clock.state === 'live' ? 'animate-pulse' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {selection != null && clock.state !== 'armed' && (
                    <span className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {selection.anchorBMs != null
                        ? `${formatTimestamp(selection.startMs)} – ${formatTimestamp(selection.endMs)}`
                        : formatTimestamp(selection.anchorAMs)}
                    </span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFilesSelected}
                    className="hidden"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach files"
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:border-violet-500/40 hover:text-violet-300 focus:outline-none focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/50"
                  >
                    <PaperClipIcon className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="submit"
                    disabled={!canPost}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PaperAirplaneIcon className="size-4" />
                    {submitting
                      ? 'Posting...'
                      : hasUploading
                        ? 'Uploading...'
                        : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Comments list — fixed height, internal scroll */}
          <div className="h-[clamp(14rem,40vh,22rem)]">
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
                      onDelete={handleDeleteRequest}
                      canDelete={canDelete}
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
                  No comments yet. Add your first timestamped note above.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <PortalConfirmDialog
        isOpen={deleteTarget !== null}
        tone="danger"
        eyebrow="Delete"
        title="Remove this comment?"
        description={
          deleteTarget?.body?.trim() ? (
            <p className="line-clamp-3 text-zinc-300 italic">
              &ldquo;{deleteTarget.body.trim()}&rdquo;
            </p>
          ) : undefined
        }
        noteTitle="This action is permanent."
        noteBody="The comment and any attached files will be removed for everyone."
        confirmLabel="Remove Comment"
        busyLabel="Removing..."
        cancelLabel="Keep Comment"
        isBusy={isDeleting}
        errorMessage={deleteError}
        onClose={handleDeleteCancel}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
