Order-confirmation email

Date: 2026-07-24.

Paid orders now get a receipt (#24), closing the commerce lane. One shared trigger, `sendOrderConfirmationEmail` in `src/lib/email/orderConfirmation.ts`, mirrors the `sendProjectStatusEmail` contract: best-effort, never throws, logs ids only (never money amounts), owner email via the `profiles` join, links from the siteConfig origin (`absoluteUrl`) since the webhook has no request origin. Sender is the existing `noreply@nova-spatial.com` Resend identity per the D13 ruling — a later subdomain swap is config-only.

The plain-text body renders exclusively from the frozen order row (never recomputed through `computeOrderPrice`, so price changes can't rewrite old receipts): song count, add-on lines from `ADD_ON_LABELS`, the `applied_coupon_code` line (code only — the discount delta isn't persisted), subtotal, the tax line from `tax_cents` with the checkout-matching label derived from `buyer_province` via `CA_TAX_RATES`, total via `formatCurrency`, portal + T&C links, and a soft "estimated delivery date once your files are received" sentence settling the 2026-07-04 gap-audit note without inventing a date field.

It fires from all 3 payment writers, and exactly once, riding the existing `claimProjectPayment` CAS fence instead of a new column: the webhook sends in its documented post-claim slot (consumption must-500 → email best-effort → ack) only when it won the claim, the payment-status poll sends only when its defensive claim won (a delayed-webhook order still gets its receipt — the webhook's replay path never sends), and the dev-bypass born-paid insert sends inline. One accepted residual: claim-ok + consume-fail 500s, and the replay that finishes the consume doesn't email — the sequencing contract keeps the email strictly after consumption.

No schema change, so no migration and no RLS/types work. 15 new tests (7 on the module, 8 across webhook/checkout/payment-status covering send-on-win, replay silence, consume-fail silence, and lost-race silence); suite (815), lint, and build green.
