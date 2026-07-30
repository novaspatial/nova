import { createHash } from 'node:crypto'

// A double-submitted checkout used to mint a second PaymentIntent and a
// second pending Project for the same order — bounded only by the 3/min
// rate limit (#59). The key folds the owner, the order's shape, and a
// coarse time bucket together: an accidental resubmit inside the bucket
// returns Stripe's original intent, while a deliberate second order of
// the same shape later gets its own.
export const IDEMPOTENCY_BUCKET_SECONDS = 300

export function buildCheckoutIdempotencyKey(
  userId: string,
  orderFingerprint: Record<string, unknown>,
  now: number = Date.now(),
): string {
  const bucket = Math.floor(now / (IDEMPOTENCY_BUCKET_SECONDS * 1000))
  const payload = JSON.stringify({ userId, bucket, order: orderFingerprint })
  return `checkout_${createHash('sha256').update(payload).digest('hex').slice(0, 48)}`
}
