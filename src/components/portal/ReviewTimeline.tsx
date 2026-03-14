'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectComment } from '@/types/portal'
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import { useAudioPlayer } from '@/components/audio/AudioProvider'

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

function CommentBubble({
  comment,
  onSeek,
}: {
  comment: ProjectComment
  onSeek?: (ms: number) => void
}) {
  const date = new Date(comment.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const isStudio = comment.author?.role === 'studio'
  const initial = (
    comment.author?.display_name?.[0] || '?'
  ).toUpperCase()

  return (
    <div className="flex gap-3 sm:gap-4">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:size-10 sm:text-sm ${
          isStudio
            ? 'border-2 border-violet-500/30 bg-violet-500/10 text-violet-400'
            : 'border-2 border-white/10 bg-white/5 text-zinc-400'
        }`}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {comment.author?.display_name || 'Anonymous'}
          </span>
          {isStudio && (
            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
              STUDIO
            </span>
          )}
          {comment.timestamp_ms !== null && (
            <button
              type="button"
              onClick={() => onSeek?.(comment.timestamp_ms!)}
              className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 transition hover:bg-violet-500/10 hover:text-violet-300"
            >
              <ClockIcon className="size-3" />
              {formatTimestamp(comment.timestamp_ms)}
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-300">{comment.body}</p>
        <p className="mt-1 text-xs text-zinc-600">{date}</p>
      </div>
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

  const handleSeek = useCallback(
    (ms: number) => {
      player.seek(ms / 1000)
    },
    [player],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!body.trim() || submitting) return

      setSubmitting(true)

      const timestampMs = parseTimestamp(timestampInput)

      try {
        const res = await fetch(
          `/api/portal/projects/${projectId}/comments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              body: body.trim(),
              timestampMs,
            }),
          },
        )

        if (!res.ok) throw new Error('Failed to post comment')

        const newComment = await res.json()
        setComments((prev) => [...prev, newComment])
        setBody('')
        setTimestampInput('')
        router.refresh()
      } catch {
        // Error handled silently — could add toast notification
      } finally {
        setSubmitting(false)
      }
    },
    [body, timestampInput, projectId, router, submitting],
  )

  return (
    <div className="space-y-6">
      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-6">
          {comments.map((comment) => (
            <CommentBubble key={comment.id} comment={comment} onSeek={handleSeek} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/2 px-6 py-12 text-center backdrop-blur-sm">
          <ChatBubbleLeftRightIcon className="size-10 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            No comments yet. Add your first timestamped note below.
          </p>
        </div>
      )}

      {/* New comment form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a mix note or feedback..."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 text-zinc-500" />
                <input
                  type="text"
                  value={timestampInput}
                  onChange={(e) => setTimestampInput(e.target.value)}
                  placeholder="0:00"
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
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
