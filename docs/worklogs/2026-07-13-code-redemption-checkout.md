Code redemption at checkout

Date: 2026-07-13.

Discount codes are redeemable end-to-end (#25): the order form gained a code field whose live quote prices with the `OrderCode` a new authed validate endpoint resolves, and checkout re-validates from scratch — catalog lookup, active/expiry, and D5 audience (returning = any prior `paid_at` project). The charge is the recomputed capped/floored total, and the code persists as `projects.applied_coupon_code` (1 new `20260713` migration: column + freeze-trigger widening + the `lookup_discount_code` RPC, with an explicit revoke since Postgres grants EXECUTE to PUBLIC by default).

All resolution lives inside the #38 seam: `reserveOrderDiscount` grew `{ submittedCode }`, a submitted code skips the first-mix reserve (1 code per order), and rejections map to 400 instead of 500. The welcome offer is code-based per D11 — the welcome code resolves in code from `WELCOME_DISCOUNT_PCT`, never a catalog row, so charge and copy can't drift — with the dormant flag path kept as the no-code fallback. Welcome/catalog orders persist `discount_applied=false`, leaving the flag's restore and consumed-check semantics exact.

2 residuals are documented, not built: concurrent welcome-code checkouts can both pass D5 before either pays, and single-use/usage-limit codes redeem without consumption — distribute none before #26. #26 plugs in at the marked points: the hold inside `reserveOrderDiscount`, the row-based restore keyed on `applied_coupon_code`, the webhook finalize reading the code from intent metadata, and the D-floor-private override into `computeOrderPrice`.
