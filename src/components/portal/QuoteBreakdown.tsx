import type { PriceBreakdown } from '@/types/portal'
import { formatCurrency } from '@/lib/formatCurrency'
import clsx from 'clsx'

// The one render of a PriceBreakdown outside PaymentStep: the order form's
// live quote and the homepage calculator (#30) both consume this, so the two
// surfaces cannot drift. Line visibility follows the breakdown itself; the
// code line additionally needs a label because a breakdown alone can't name
// the coupon.
export function QuoteBreakdown({
  quote,
  codeLabel,
  footnote,
  className,
}: {
  quote: PriceBreakdown
  codeLabel?: string | null
  footnote?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-testid="live-quote"
      aria-live="polite"
      className={clsx(
        'rounded-xl border border-white/10 bg-white/5 p-4',
        className,
      )}
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
      {codeLabel && quote.code_discount_cents > 0 && (
        <div className="mt-1 flex items-center justify-between text-xs text-violet-300 sm:text-sm">
          <span>{codeLabel}</span>
          <span>−{formatCurrency(quote.code_discount_cents)}</span>
        </div>
      )}
      {quote.add_ons_cents > 0 && (
        <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
          <span>Add-ons</span>
          <span>{formatCurrency(quote.add_ons_cents)}</span>
        </div>
      )}
      {quote.tax_cents > 0 && (
        <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 sm:text-sm">
          <span>{quote.tax_label}</span>
          <span>{formatCurrency(quote.tax_cents)}</span>
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
      {footnote && <p className="mt-1 text-xs text-zinc-500">{footnote}</p>}
    </div>
  )
}
