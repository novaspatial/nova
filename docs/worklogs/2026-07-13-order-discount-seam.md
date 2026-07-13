Order-discount seam

Date: 2026-07-13.

The first-mix discount orchestration moved out of the checkout route into 1 module, `src/lib/portal/orderDiscount.ts` — the prefactor (#38) the code-redemption chain lands on. The route had 1 reserve call but 4 hand-copied restore sites (dev-bypass insert failure, Stripe failure, insert failure, and project cleanup), each rebuilding the RPC payload and its own logging, plus the first-mix code constant living in the route where the client quote couldn't share it.

The seam is a reservation handle: `reserveOrderDiscount` wraps the atomic reserve RPC and returns the `OrderCode` to price with plus a single `release()` that every failure path calls unconditionally — a no-op when nothing was reserved, logged-never-thrown otherwise. `restoreUnpaidOrderDiscount` is the cross-request counterpart for abandon/delete, reconstructing the hold from the project row; `projectCleanup` now delegates its conditional to it. The Stripe-before-reserve ordering rule became the documented contract of `reserveOrderDiscount` instead of a route comment, and `FIRST_MIX_CODE` is exported from the client-safe module so quote and charge read 1 source.

No behavior change: the 639-test suite passes with the route and cleanup tests untouched, plus 10 new seam tests. #25 plugs catalog-code resolution (lookup, expiry, D5 eligibility) inside `reserveOrderDiscount` without reshaping the route, and #26 adds its single-use hold to the same handle — release restores it on abandon, the webhook finalizes on payment per D6.
