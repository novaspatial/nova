'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscountCode, DiscountKind } from '@/types/portal'
import { formatCurrency } from '@/lib/formatCurrency'

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
  const [referral, setReferral] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          referralAttribution: referral.trim() || null,
          allowBelowFloor: belowFloor,
        }),
      })
      const data = (await res.json()) as DiscountCode & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create code')
      }
      setCodes((prev) => [data, ...prev])
      setCode('')
      setValue('')
      setExpiresAt('')
      setUsageLimit('')
      setReferral('')
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

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/2 p-6"
      >
        <h2 className="text-sm font-semibold text-white sm:text-base">
          Generate a code
        </h2>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 sm:text-sm"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
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
            <select
              id="dc-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DiscountKind)}
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            >
              <option value="percent" className="bg-zinc-900">
                Percent (%)
              </option>
              <option value="fixed" className="bg-zinc-900">
                Fixed amount (cents)
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="dc-value" className={labelClassName}>
              {kind === 'percent' ? 'Percent off' : 'Amount off (cents)'}
            </label>
            <input
              id="dc-value"
              type="number"
              required
              min={1}
              max={kind === 'percent' ? 100 : undefined}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={kind === 'percent' ? '15' : '5000'}
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="dc-expiry" className={labelClassName}>
              Expiry <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="dc-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="dc-audience" className={labelClassName}>
              Audience
            </label>
            <select
              id="dc-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            >
              <option value="all" className="bg-zinc-900">
                All clients
              </option>
              <option value="new" className="bg-zinc-900">
                New clients only
              </option>
              <option value="returning" className="bg-zinc-900">
                Returning clients only
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="dc-usage-limit" className={labelClassName}>
              Usage limit <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              id="dc-usage-limit"
              type="number"
              min={1}
              step={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Unlimited"
              className={`mt-2 ${inputClassName}`}
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="dc-referral" className={labelClassName}>
            Referral attribution <span className="text-zinc-500">(optional)</span>
          </label>
          <input
            id="dc-referral"
            type="text"
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
            placeholder="e.g. Artist X referral program"
            className={`mt-2 ${inputClassName}`}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-zinc-300 sm:text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => {
                setIsPublic(e.target.checked)
                // D-floor-private is private-only (DB CHECK): going public
                // clears the override rather than letting the POST 400.
                if (e.target.checked) setBelowFloor(false)
              }}
              disabled={submitting}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
            />
            Public (stacks with album discount)
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300 sm:text-sm">
            <input
              type="checkbox"
              checked={singleUse}
              onChange={(e) => setSingleUse(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
            />
            Single use
          </label>
          {!isPublic && (
            <label className="flex items-center gap-2 text-xs text-zinc-300 sm:text-sm">
              <input
                type="checkbox"
                checked={belowFloor}
                onChange={(e) => setBelowFloor(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
              />
              Can price below the $225/song floor
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-6 py-3 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {submitting ? 'Creating…' : 'Create code'}
        </button>
      </form>

      {codes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/2 p-8 text-center text-base text-zinc-400">
          No codes yet. Generate the first one above.
        </div>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/2">
          {codes.map((c) => {
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
                    {c.referral_attribution && ` · ${c.referral_attribution}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(c)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                >
                  {c.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
