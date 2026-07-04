'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { FileUploader, PaymentStep } from '@/components/portal'
import { Checkbox } from '@/components/ui/Checkbox'
import type { FileUploadItem, PriceBreakdown, Project } from '@/types/portal'
import { uploadFile } from '@/lib/portal/uploadFile'
import { computeOrderPrice } from '@/lib/stripe/pricing'
import { formatCurrency } from '@/lib/formatCurrency'
import { TERMS_VERSION } from '@/lib/legal/terms'

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 sm:text-sm'

type Phase = 'form' | 'payment' | 'uploading'

type ServiceFormat = Project['format']

const SERVICE_OPTIONS: { value: ServiceFormat; label: string }[] = [
  { value: 'atmos', label: 'Dolby Atmos' },
  { value: 'binaural', label: 'Binaural' },
  { value: 'both', label: 'Both (Atmos + Binaural)' },
]

const MAX_SONG_COUNT = 99

type CheckoutResponse = {
  projectId: string
  clientSecret: string | null
  amountCents: number
  currency: string
  discountApplied: boolean
  breakdown: PriceBreakdown
  devBypass?: boolean
}


function findDuplicateFileNames(items: FileUploadItem[]): string[] {
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const item of items) {
    const name = item.file.name
    if (seen.has(name)) dups.add(name)
    else seen.add(name)
  }
  return Array.from(dups)
}

async function waitForPaymentConfirmation(
  projectId: string,
  timeoutMs = 30_000,
  intervalMs = 1_500,
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    // A transient fetch failure must not abort the poll — the payment may
    // already have succeeded; keep polling until the deadline.
    try {
      const res = await fetch(
        `/api/portal/projects/${projectId}/payment-status`,
        { cache: 'no-store' },
      )
      if (res.ok) {
        const data = (await res.json()) as { paid?: boolean }
        if (data.paid) return true
      }
    } catch (pollErr) {
      console.error('[NewProjectForm] payment-status poll failed', pollErr)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

export function NewProjectForm() {
  const [phase, setPhase] = useState<Phase>('form')
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<ServiceFormat>('atmos')
  const [songCountInput, setSongCountInput] = useState('1')
  const [referenceTracks, setReferenceTracks] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null)
  // Set right before our own success redirect so the beforeunload guard
  // doesn't prompt on a navigation the user didn't initiate.
  const navigatingAwayRef = useRef(false)

  // Number() (not parseInt) so exponent notation the number input accepts
  // ('2e1' = 20) can't silently truncate to its mantissa.
  const songCount = songCountInput.trim() === '' ? NaN : Number(songCountInput)
  const songCountValid =
    Number.isInteger(songCount) && songCount >= 1 && songCount <= MAX_SONG_COUNT

  // Live list-price quote. Welcome/first-mix discounts are applied
  // server-side at checkout, so the quote here is the pre-code price;
  // the payment step shows the final charge.
  const quote = useMemo(
    () => (songCountValid ? computeOrderPrice({ songCount }) : null),
    [songCountValid, songCount],
  )

  useEffect(() => {
    // Guard both payment AND upload: closing the tab mid-upload (after
    // paying) would abort the stem uploads just as silently.
    if (phase === 'form') return
    const handler = (e: BeforeUnloadEvent) => {
      if (navigatingAwayRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const items: FileUploadItem[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...items])
  }, [])

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const rollbackProject = useCallback(async (projectId: string) => {
    try {
      await fetch(`/api/portal/projects/${projectId}`, { method: 'DELETE' })
    } catch (rollbackErr) {
      console.error('[NewProjectForm] project rollback failed', rollbackErr)
    }
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: 'pending' as const,
        progress: 0,
        error: undefined,
      })),
    )
  }, [])

  const runUploadLoop = useCallback(
    async (projectId: string) => {
      let failureCount = 0
      for (const item of files) {
        if (item.status === 'uploaded' || item.status === 'synced') continue

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'uploading' as const } : f,
          ),
        )

        try {
          const registerRes = await fetch(
            `/api/portal/projects/${projectId}/files`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.file.name,
                fileSize: item.file.size,
                mimeType: item.file.type || 'audio/x-wav',
                fileType: 'stem',
              }),
            },
          )
          if (!registerRes.ok) {
            const data = (await registerRes.json().catch(() => ({}))) as {
              error?: string
            }
            throw new Error(data.error || 'Failed to register file')
          }
          const { fileId, uploadUrl } = (await registerRes.json()) as {
            fileId: string
            uploadUrl: string
          }

          await uploadFile(item.file, uploadUrl, (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, progress } : f,
              ),
            )
          })

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, status: 'uploaded' as const, progress: 100 }
                : f,
            ),
          )

          const confirmRes = await fetch(
            `/api/portal/projects/${projectId}/files/${fileId}/confirm`,
            { method: 'POST' },
          )
          if (!confirmRes.ok) {
            throw new Error('Failed to confirm file upload')
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: 'synced' as const } : f,
            ),
          )
        } catch (fileErr) {
          failureCount++
          const message =
            fileErr instanceof Error ? fileErr.message : 'Upload failed'
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'failed' as const,
                    error: message,
                    progress: 0,
                  }
                : f,
            ),
          )
        }
      }
      return failureCount
    },
    [files],
  )

  const uploadAndNavigate = useCallback(
    async (projectId: string, skipConfirmation = false) => {
      setPhase('uploading')
      setError(null)

      if (!skipConfirmation) {
        const confirmed = await waitForPaymentConfirmation(projectId)
        if (!confirmed) {
          setError(
            "We couldn't confirm your payment in time. If you were charged, your project is preserved — please refresh or contact support.",
          )
          return
        }
      }

      const failureCount = await runUploadLoop(projectId)
      if (failureCount > 0) {
        setError(
          `${failureCount} file${failureCount > 1 ? 's' : ''} failed to upload. Your payment went through — visit the project page to retry.`,
        )
        return
      }

      navigatingAwayRef.current = true
      window.location.assign(`/portal/${projectId}/upload`)
    },
    [runUploadLoop],
  )

  // Stem-upload reconciliation (S1 #16): stems are selected in this form but
  // upload only AFTER payment confirms (uploadAndNavigate polls payment-status
  // first). The project row is created at checkout in pending_payment, so an
  // abandoned checkout never leaves orphaned storage objects — only a row the
  // DELETE rollback cleans up. stem_count is captured at checkout from the
  // files actually selected here, not from a separate free-typed input.
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!title.trim()) {
        setError('Project title is required.')
        return
      }
      if (!songCountValid) {
        setError(
          `Song count must be a whole number between 1 and ${MAX_SONG_COUNT}.`,
        )
        return
      }
      if (files.length === 0) {
        setError('Please add at least one file.')
        return
      }
      const duplicates = findDuplicateFileNames(files)
      if (duplicates.length > 0) {
        setError(
          `Duplicate file names: ${duplicates.join(', ')}. Remove duplicates before submitting.`,
        )
        return
      }
      if (!termsAccepted) {
        setError('Please accept the Terms & Conditions to continue.')
        return
      }

      setSubmitting(true)
      setError(null)

      try {
        const res = await fetch('/api/portal/projects/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            format,
            songCount,
            stemCount: files.length,
            referenceTracks: referenceTracks.trim() || null,
            notes: notes.trim() || null,
            termsAcceptedVersion: termsAccepted ? TERMS_VERSION : null,
          }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(data.error || 'Failed to start checkout')
        }
        const data = (await res.json()) as CheckoutResponse

        if (data.devBypass) {
          setCheckout(data)
          await uploadAndNavigate(data.projectId, true)
          return
        }

        // A malformed response must not fall through to a re-enabled form
        // with a project row already created server-side.
        if (!data.clientSecret || !data.breakdown) {
          throw new Error(
            'Checkout could not be initialized. Please try again.',
          )
        }

        setCheckout(data)
        setPhase('payment')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setSubmitting(false)
      }
    },
    [
      title,
      format,
      songCount,
      songCountValid,
      referenceTracks,
      notes,
      files,
      termsAccepted,
      uploadAndNavigate,
    ],
  )

  const handlePaymentSucceeded = useCallback(async () => {
    if (!checkout) return
    await uploadAndNavigate(checkout.projectId)
  }, [checkout, uploadAndNavigate])

  const handlePaymentCancel = useCallback(async () => {
    if (!checkout) return
    await rollbackProject(checkout.projectId)
    setCheckout(null)
    setPhase('form')
  }, [checkout, rollbackProject])

  if (phase === 'payment' && checkout?.clientSecret && checkout.breakdown) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-xs font-medium text-zinc-300 sm:text-sm">
            Complete payment
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Your project <span className="text-zinc-300">{title}</span> is
            reserved. Pay to start uploading.
          </div>
        </div>
        <PaymentStep
          clientSecret={checkout.clientSecret}
          amountCents={checkout.amountCents}
          currency={checkout.currency}
          discountApplied={checkout.discountApplied}
          breakdown={checkout.breakdown}
          onSucceeded={handlePaymentSucceeded}
          onCancel={handlePaymentCancel}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 sm:text-sm"
        >
          {error}
        </div>
      )}

      {checkout?.devBypass && phase === 'uploading' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:text-sm">
          Dev mode — payment bypassed ($0). Uploading directly.
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Project Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Album Name — Dolby Atmos Mix"
          className={`mt-2 ${inputClassName}`}
          disabled={submitting || phase === 'uploading'}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="service"
            className="block text-xs font-medium text-zinc-300 sm:text-sm"
          >
            Service
          </label>
          <div className="relative mt-2">
            <select
              id="service"
              value={format}
              onChange={(e) => setFormat(e.target.value as ServiceFormat)}
              className={`appearance-none pr-10 ${inputClassName}`}
              disabled={submitting || phase === 'uploading'}
            >
              {SERVICE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-zinc-900"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-zinc-500"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div>
          <label
            htmlFor="song-count"
            className="block text-xs font-medium text-zinc-300 sm:text-sm"
          >
            Number of Songs
          </label>
          <input
            id="song-count"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={MAX_SONG_COUNT}
            step={1}
            value={songCountInput}
            onChange={(e) => setSongCountInput(e.target.value)}
            className={`mt-2 ${inputClassName}`}
            disabled={submitting || phase === 'uploading'}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="reference-tracks"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Reference Tracks <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="reference-tracks"
          value={referenceTracks}
          onChange={(e) => setReferenceTracks(e.target.value)}
          placeholder="Links or artist/song names of mixes you want us to reference..."
          rows={2}
          className={`mt-2 resize-none ${inputClassName}`}
          disabled={submitting || phase === 'uploading'}
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Project Notes{' '}
          <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any preferences or instructions for the mix engineer..."
          rows={4}
          className={`mt-2 resize-none ${inputClassName}`}
          disabled={submitting || phase === 'uploading'}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-300 sm:text-sm">
          Upload Stems
        </label>
        <div className="mt-2">
          <FileUploader
            files={files}
            onFilesAdded={handleFilesAdded}
            onRemove={handleRemove}
            disabled={submitting || phase === 'uploading'}
          />
        </div>
        {files.length > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            {files.length} stem file{files.length > 1 ? 's' : ''} selected —
            saved with your order. Files upload after payment is confirmed.
          </p>
        )}
      </div>

      {quote && (
        <div
          data-testid="live-quote"
          aria-live="polite"
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
            <span>
              {quote.song_count} song{quote.song_count > 1 ? 's' : ''} ×{' '}
              {formatCurrency(quote.list_unit_cents)}
            </span>
            <span>{formatCurrency(quote.list_total_cents)}</span>
          </div>
          {quote.bulk_discount_cents > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs text-emerald-300 sm:text-sm">
              <span>Album discount</span>
              <span>−{formatCurrency(quote.bulk_discount_cents)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
            <span className="text-xs font-medium text-zinc-300 sm:text-sm">
              Estimated total
            </span>
            <span className="text-lg font-semibold text-white">
              {formatCurrency(quote.total_cents)}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Eligible welcome discounts are applied at payment.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Checkbox
          isSelected={termsAccepted}
          onChange={setTermsAccepted}
          isDisabled={submitting || phase === 'uploading'}
        >
          <span className="text-xs text-zinc-300 sm:text-sm">
            I have read and agree to the Terms &amp; Conditions.
          </span>
        </Checkbox>
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-violet-300 hover:text-violet-200"
        >
          View Terms &amp; Conditions ↗
        </Link>
      </div>

      <button
        type="submit"
        disabled={submitting || phase === 'uploading'}
        className="w-full rounded-xl bg-violet-600 px-6 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
      >
        {submitting
          ? 'Creating Project & Uploading...'
          : phase === 'uploading'
            ? 'Uploading files…'
            : 'Create Project & Upload'}
      </button>
    </form>
  )
}
