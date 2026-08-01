'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscountCode, DiscountKind } from '@/types/portal'
import { formatCurrency } from '@/lib/formatCurrency'
import { PortalConfirmDialog } from '@/components/portal/PortalConfirmDialog'
import { Checkbox } from '@/components/ui/Checkbox'
import { NumberInput } from '@/components/ui/NumberInput'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 sm:text-sm'

const labelClassName = 'block text-xs font-medium text-zinc-300 sm:text-sm'

type Audience = 'all' | 'new' | 'returning'

function codeValueLabel(code: DiscountCode) {
  return code.kind === 'percent' ? `${code.value}%` : formatCurrency(code.value)
}

function codeStatus(code: DiscountCode): 'active' | 'expired' | 'disabled' {
  if (!code.active) return 'disabled'
  if (code.expires_at && Date.parse(code.expires_at) < Date.now()) {
    return 'expired'
  }
  return 'active'
}

// Consumption per #26: redeemed = finalized on confirmed payment, against
// the effective capacity (single-use dominates a usage limit; null =
// unlimited).
function redemptionLabel(code: DiscountCode) {
  const limit = code.single_use ? 1 : code.usage_limit
  return limit === null
    ? `redeemed ${code.redeemed_count}`
    : `redeemed ${code.redeemed_count}/${limit}`
}

const PAGE_SIZE = 5

const STATUS_STYLES: Record<ReturnType<typeof codeStatus>, string> = {
  active: 'bg-emerald-500/15 text-emerald-300',
  expired: 'bg-amber-500/15 text-amber-300',
  disabled: 'bg-zinc-500/15 text-zinc-400',
}

export function DiscountCodesAdmin({
  initialCodes,
}: {
  initialCodes: DiscountCode[]
}) {
  const router = useRouter()
  const [codes, setCodes] = useState(initialCodes)
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<DiscountKind>('percent')
  const [value, setValue] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [isPublic, setIsPublic] = useState(false)
  const [singleUse, setSingleUse] = useState(false)
  const [belowFloor, setBelowFloor] = useState(false)
  const [usageLimit, setUsageLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  // deleteTarget survives the dialog's exit animation; isDeleteOpen drives it.
  const [deleteTarget, setDeleteTarget] = useState<DiscountCode | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const pageCount = Math.max(1, Math.ceil(codes.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleCodes = codes.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          kind,
          value: Number(value),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          isPublic,
          singleUse,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          newClientsOnly: audience === 'new',
          returningClientsOnly: audience === 'returning',
          allowBelowFloor: belowFloor,
        }),
      })
      const data = (await res.json()) as DiscountCode & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create code')
      }
      setCodes((prev) => [data, ...prev])
      setPage(1)
      setCode('')
      setValue('')
      setExpiresAt('')
      setUsageLimit('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (target: DiscountCode) => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/discount-codes/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !target.active }),
      })
      const data = (await res.json()) as DiscountCode & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update code')
      }
      setCodes((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/discount-codes/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error || 'Failed to delete code')
      }
      setCodes((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setIsDeleteOpen(false)
      router.refresh()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Something went wrong',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleCreate}
        className="space-y-8 rounded-2xl border border-white/10 bg-white/2 p-6"
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 sm:text-sm"
          >
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="dc-code" className={labelClassName}>
              Code name
            </label>
            <input
              id="dc-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME15"
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="dc-kind" className={labelClassName}>
              Type
            </label>
            <Select<DiscountKind>
              id="dc-kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'percent', label: 'Percent (%)' },
                { value: 'fixed', label: 'Fixed amount (cents)' },
              ]}
              disabled={submitting}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="dc-value" className={labelClassName}>
              {kind === 'percent' ? 'Percent off' : 'Amount off (cents)'}
            </label>
            <NumberInput
              id="dc-value"
              label={kind === 'percent' ? 'percent off' : 'amount off'}
              required
              min={1}
              max={kind === 'percent' ? 100 : undefined}
              value={value}
              onChange={setValue}
              placeholder={kind === 'percent' ? '15' : '5000'}
              className="mt-2"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="dc-expiry" className={labelClassName}>
              Expiry <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="dc-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`mt-2 scheme-dark ${inputClassName}`}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="dc-audience" className={labelClassName}>
              Audience
            </label>
            <Select<Audience>
              id="dc-audience"
              value={audience}
              onChange={setAudience}
              options={[
                { value: 'all', label: 'All clients' },
                { value: 'new', label: 'New clients only' },
                { value: 'returning', label: 'Returning clients only' },
              ]}
              disabled={submitting}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="dc-usage-limit" className={labelClassName}>
              Usage limit <span className="text-zinc-500">(optional)</span>
            </label>
            <NumberInput
              id="dc-usage-limit"
              label="usage limit"
              min={1}
              value={usageLimit}
              onChange={setUsageLimit}
              placeholder="Unlimited"
              className="mt-2"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <Checkbox
            isSelected={isPublic}
            onChange={(checked) => {
              setIsPublic(checked)
              // D-floor-private is private-only (DB CHECK): going public
              // clears the override rather than letting the POST 400.
              if (checked) setBelowFloor(false)
            }}
            isDisabled={submitting}
          >
            <span className="text-xs text-zinc-300 sm:text-sm">
              Public (stacks with album discount)
            </span>
          </Checkbox>
          <Checkbox
            isSelected={singleUse}
            onChange={setSingleUse}
            isDisabled={submitting}
          >
            <span className="text-xs text-zinc-300 sm:text-sm">Single use</span>
          </Checkbox>
          {!isPublic && (
            <Checkbox
              isSelected={belowFloor}
              onChange={setBelowFloor}
              isDisabled={submitting}
            >
              <span className="text-xs text-zinc-300 sm:text-sm">
                Can price below the $225/song floor
              </span>
            </Checkbox>
          )}
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-violet-600 px-6 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {submitting ? 'Creating…' : 'Create code'}
          </button>
        </div>
      </form>

      {codes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center text-base text-zinc-400">
          No codes yet. Generate the first one above.
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/2">
            {visibleCodes.map((c) => {
              const status = codeStatus(c)
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-white">
                        {c.code}
                      </span>
                      <span className="text-sm text-zinc-300">
                        {codeValueLabel(c)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${STATUS_STYLES[status]}`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {c.is_public ? 'Public' : 'Private'}
                      {c.single_use && ' · single use'}
                      {c.usage_limit !== null && ` · limit ${c.usage_limit}`}
                      {c.allow_below_floor && ' · below floor'}
                      {` · ${redemptionLabel(c)}`}
                      {c.new_clients_only && ' · new clients'}
                      {c.returning_clients_only && ' · returning clients'}
                      {c.expires_at &&
                        ` · expires ${new Date(c.expires_at).toLocaleDateString('en-US')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(c)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                    >
                      {c.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {!c.active && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(c)
                          setDeleteError(null)
                          setIsDeleteOpen(true)
                        }}
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {codes.length > PAGE_SIZE && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <PortalConfirmDialog
        isOpen={isDeleteOpen}
        tone="danger"
        title="Delete this code?"
        description={
          deleteTarget && (
            <p>
              <span className="font-mono font-medium text-zinc-200">
                {deleteTarget.code}
              </span>{' '}
              is removed from the catalog for good. Orders that already
              redeemed it keep their price and history.
            </p>
          )
        }
        confirmLabel="Delete code"
        busyLabel="Deleting…"
        isBusy={deleting}
        errorMessage={deleteError}
        onClose={() => {
          if (!deleting) setIsDeleteOpen(false)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
