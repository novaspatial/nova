'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { FileUploader, PaymentStep } from '@/components/portal'
// Direct import (not the barrel): the form's tests mock '@/components/portal'
// for the heavy Stripe/upload children, but the quote must render for real.
import { QuoteBreakdown } from '@/components/portal/QuoteBreakdown'
import { Checkbox } from '@/components/ui/Checkbox'
import { NumberInput } from '@/components/ui/NumberInput'
import type {
  AddOn,
  BuyerCountry,
  BuyerLocation,
  CAProvince,
  FileUploadItem,
  PriceBreakdown,
  Project,
} from '@/types/portal'
import { runUploadDance } from '@/lib/portal/uploadRunner'
import {
  ADD_ON_CENTS,
  ADD_ON_LABELS,
  ADD_ON_VALUES,
  computeOrderPrice,
  MAX_SONG_COUNT,
  WELCOME_DISCOUNT_PCT,
  type OrderCode,
} from '@/lib/stripe/pricing'
import {
  discountBadgeLabel,
  WELCOME_COUPON_CODE,
} from '@/lib/portal/orderDiscount'
import { TERMS_VERSION } from '@/lib/legal/terms'
import { formatCurrency } from '@/lib/formatCurrency'

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 sm:text-sm'

type Phase = 'form' | 'payment' | 'uploading'

type ServiceFormat = Project['format']

const SERVICE_OPTIONS: { value: ServiceFormat; label: string }[] = [
  { value: 'atmos', label: 'Dolby Atmos' },
  { value: 'binaural', label: 'Binaural' },
  { value: 'both', label: 'Both (Atmos + Binaural)' },
]

// Same derivation as the homepage calculator (#30) — labels and prices from
// the shared pricing constants, so the two surfaces can't drift (#19).
const ADD_ON_OPTIONS = ADD_ON_VALUES.map((value) => ({
  value,
  label: `${ADD_ON_LABELS[value]} (+${formatCurrency(ADD_ON_CENTS[value])})`,
}))

// Billing location for GST/HST (#31, D2). Values are what the checkout API
// validates and the DB CHECKs mirror; province full names are display-only.
const COUNTRY_OPTIONS: { value: BuyerCountry; label: string }[] = [
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'United States' },
  { value: 'OTHER', label: 'Other / International' },
]

const PROVINCE_OPTIONS: { value: CAProvince; label: string }[] = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
]

function SelectChevron() {
  return (
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
  )
}

type CheckoutResponse = {
  projectId: string
  clientSecret: string | null
  amountCents: number
  currency: string
  discountApplied: boolean
  appliedCouponCode: string | null
  breakdown: PriceBreakdown
  devBypass?: boolean
}

// The validate endpoint's success shape (#25): the resolved OrderCode feeds
// the same computeOrderPrice the charge uses, so preview and charge agree.
type AppliedCode = {
  couponCode: string
  code: OrderCode
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

// Prefill props come from the homepage calculator's deep link (#30), parsed
// and validated server-side in page.tsx (parseNewProjectParams).
export function NewProjectForm({
  initialSongCount,
  initialAddOns,
  initialCode,
}: {
  initialSongCount?: number
  initialAddOns?: AddOn[]
  initialCode?: string
} = {}) {
  const [phase, setPhase] = useState<Phase>('form')
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<ServiceFormat>('atmos')
  const [songCountInput, setSongCountInput] = useState(
    String(initialSongCount ?? 1),
  )
  const [addOns, setAddOns] = useState<AddOn[]>(initialAddOns ?? [])
  const [referenceTracks, setReferenceTracks] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<FileUploadItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  // Empty defaults on purpose: a Canadian must never be silently quoted
  // untaxed, so an explicit choice is required before submit (#31).
  const [billingCountry, setBillingCountry] = useState<'' | BuyerCountry>('')
  const [billingProvince, setBillingProvince] = useState<'' | CAProvince>('')
  // Discount code (#25): the preview applies via the validate endpoint; the
  // checkout re-validates server-side, so an un-applied typed code is still
  // honored (or rejected) at submit.
  const [codeInput, setCodeInput] = useState(initialCode ?? '')
  const [appliedCode, setAppliedCode] = useState<AppliedCode | null>(null)
  const [applyingCode, setApplyingCode] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null)
  // Set right before our own success redirect so the beforeunload guard
  // doesn't prompt on a navigation the user didn't initiate.
  const navigatingAwayRef = useRef(false)

  // Number() (not parseInt) so exponent notation the number input accepts
  // ('2e1' = 20) can't silently truncate to its mantissa.
  const songCount = songCountInput.trim() === '' ? NaN : Number(songCountInput)
  const songCountValid =
    Number.isInteger(songCount) && songCount >= 1 && songCount <= MAX_SONG_COUNT

  // Tax needs a complete location — a country, plus a province when Canadian
  // (place of supply picks the GST/HST rate). Until the selection completes,
  // the quote renders untaxed; the selects are required to submit.
  const buyer: BuyerLocation | null = useMemo(() => {
    if (billingCountry === '') return null
    if (billingCountry === 'CA') {
      return billingProvince === ''
        ? null
        : { country: 'CA', province: billingProvince }
    }
    return { country: billingCountry }
  }, [billingCountry, billingProvince])

  // Live quote, priced with the applied code's resolved OrderCode — the same
  // shape the server charge uses, so preview and charge cannot disagree. The
  // server remains authoritative: checkout re-validates from scratch and the
  // payment step renders the server's breakdown.
  const quote = useMemo(
    () =>
      songCountValid
        ? computeOrderPrice({
            songCount,
            addOns,
            buyer,
            code: appliedCode?.code ?? null,
          })
        : null,
    [songCountValid, songCount, addOns, buyer, appliedCode],
  )

  const toggleAddOn = (addOn: AddOn) => (checked: boolean) => {
    setAddOns((prev) =>
      checked ? [...prev, addOn] : prev.filter((a) => a !== addOn),
    )
  }

  const handleApplyCode = useCallback(async () => {
    const trimmed = codeInput.trim()
    if (!trimmed) {
      setCodeError('Enter a discount code')
      return
    }
    setApplyingCode(true)
    setCodeError(null)
    try {
      const res = await fetch('/api/portal/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        couponCode?: string
        code?: OrderCode
      }
      if (!res.ok || !data.couponCode || !data.code) {
        throw new Error(data.error || 'Unable to validate the code right now.')
      }
      setAppliedCode({ couponCode: data.couponCode, code: data.code })
      setCodeInput(data.couponCode)
    } catch (err) {
      setAppliedCode(null)
      setCodeError(
        err instanceof Error ? err.message : 'Unable to validate the code',
      )
    } finally {
      setApplyingCode(false)
    }
  }, [codeInput])

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
          await runUploadDance({
            projectId,
            file: item.file,
            kind: 'stem',
            onProgress: (progress) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id ? { ...f, progress } : f,
                ),
              )
            },
            onUploaded: () => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id
                    ? { ...f, status: 'uploaded' as const, progress: 100 }
                    : f,
                ),
              )
            },
          })

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
      // Mirrors the checkout route's validation (same error strings).
      if (billingCountry === '') {
        setError('Select a billing country')
        return
      }
      if (billingCountry === 'CA' && billingProvince === '') {
        setError('Select a province or territory')
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
            // Click order; the server re-validates and canonicalizes (#19).
            addOns,
            referenceTracks: referenceTracks.trim() || null,
            notes: notes.trim() || null,
            billingCountry,
            billingProvince: billingCountry === 'CA' ? billingProvince : null,
            termsAcceptedVersion: termsAccepted ? TERMS_VERSION : null,
            // The server re-validates whatever is sent; a typed-but-unapplied
            // code is honored (or rejected with a clear 400) at checkout.
            code:
              appliedCode?.couponCode ??
              (codeInput.trim() ? codeInput.trim().toUpperCase() : null),
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
      addOns,
      billingCountry,
      billingProvince,
      referenceTracks,
      notes,
      files,
      termsAccepted,
      appliedCode,
      codeInput,
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
          appliedCouponCode={checkout.appliedCouponCode ?? null}
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
            <SelectChevron />
          </div>
        </div>

        <div>
          <label
            htmlFor="song-count"
            className="block text-xs font-medium text-zinc-300 sm:text-sm"
          >
            Number of Songs
          </label>
          <NumberInput
            id="song-count"
            label="number of songs"
            required
            min={1}
            max={MAX_SONG_COUNT}
            value={songCountInput}
            onChange={setSongCountInput}
            className="mt-2"
            disabled={submitting || phase === 'uploading'}
          />
        </div>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-zinc-300 sm:text-sm">
          Add-ons <span className="text-zinc-500">(optional)</span>
        </legend>
        <div className="mt-2 space-y-2">
          {ADD_ON_OPTIONS.map((option) => (
            <Checkbox
              key={option.value}
              isSelected={addOns.includes(option.value)}
              onChange={toggleAddOn(option.value)}
              isDisabled={submitting || phase === 'uploading'}
            >
              <span className="text-xs text-zinc-300 sm:text-sm">
                {option.label}
              </span>
            </Checkbox>
          ))}
        </div>
      </fieldset>

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

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="billing-country"
            className="block text-xs font-medium text-zinc-300 sm:text-sm"
          >
            Billing Country
          </label>
          <div className="relative mt-2">
            <select
              id="billing-country"
              required
              value={billingCountry}
              onChange={(e) => {
                const value = e.target.value as '' | BuyerCountry
                setBillingCountry(value)
                if (value !== 'CA') setBillingProvince('')
              }}
              className={`appearance-none pr-10 ${inputClassName}`}
              disabled={submitting || phase === 'uploading'}
            >
              <option value="" disabled className="bg-zinc-900">
                Select country…
              </option>
              {COUNTRY_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-zinc-900"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        {billingCountry === 'CA' && (
          <div>
            <label
              htmlFor="billing-province"
              className="block text-xs font-medium text-zinc-300 sm:text-sm"
            >
              Province / Territory
            </label>
            <div className="relative mt-2">
              <select
                id="billing-province"
                required
                value={billingProvince}
                onChange={(e) =>
                  setBillingProvince(e.target.value as '' | CAProvince)
                }
                className={`appearance-none pr-10 ${inputClassName}`}
                disabled={submitting || phase === 'uploading'}
              >
                <option value="" disabled className="bg-zinc-900">
                  Select province…
                </option>
                {PROVINCE_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-zinc-900"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="discount-code"
          className="block text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Discount Code <span className="text-zinc-500">(optional)</span>
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="discount-code"
            type="text"
            value={codeInput}
            onChange={(e) => {
              // Editing after Apply de-applies: the preview must never show
              // a discount for a code that is no longer in the field.
              setCodeInput(e.target.value)
              setAppliedCode(null)
              setCodeError(null)
            }}
            placeholder="e.g. WELCOME"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={inputClassName}
            disabled={submitting || phase === 'uploading'}
          />
          <button
            type="button"
            onClick={handleApplyCode}
            disabled={applyingCode || submitting || phase === 'uploading'}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold text-zinc-200 transition hover:border-violet-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {applyingCode ? 'Checking…' : 'Apply'}
          </button>
        </div>
        {codeError && (
          <p role="alert" className="mt-2 text-xs text-red-300">
            {codeError}
          </p>
        )}
        {appliedCode && !codeError && (
          <p className="mt-2 text-xs text-emerald-300">
            {appliedCode.couponCode} applied — reflected in the quote below.
          </p>
        )}
        {!appliedCode && !codeError && (
          <p className="mt-2 text-xs text-zinc-500">
            New here? Use code {WELCOME_COUPON_CODE} for {WELCOME_DISCOUNT_PCT}
            % off your first mix.
          </p>
        )}
      </div>

      {quote && (
        <QuoteBreakdown
          quote={quote}
          codeLabel={
            appliedCode ? discountBadgeLabel(appliedCode.couponCode, false) : null
          }
          footnote="Prices are in USD. Discount codes are verified at payment; GST/HST is calculated on the discounted total."
        />
      )}

      <Checkbox
        isSelected={termsAccepted}
        onChange={setTermsAccepted}
        isDisabled={submitting || phase === 'uploading'}
      >
        <span className="text-xs text-zinc-300 sm:text-sm">
          I have read and agree to the{' '}
          {/* Inline link: an <a href> descendant of the label doesn't trigger
              the checkbox toggle (HTML spec); stopPropagation guards React Aria
              too. Opens in a new tab so the in-progress form isn't lost. */}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-violet-300 underline decoration-violet-300/40 underline-offset-2 transition-colors hover:text-violet-200"
          >
            Terms &amp; Conditions
          </Link>
          .
        </span>
      </Checkbox>

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
