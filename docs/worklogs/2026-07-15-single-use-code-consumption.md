# Single-use code consumption

Date: 2026-07-15

Goal: make single-use and limited codes actually burn (#26, D6) — reserved atomically at checkout, consumed exactly once on payment, released on abandon — so codes are finally safe to distribute.

discount_codes grew reserved_count/redeemed_count. Checkout takes an atomic hold per catalog code (reserve_discount_code, a compare-and-swap re-checking active/expiry/capacity), and the webhook finalizes via consume_discount_code, idempotent per project through the discount_redemptions ledger; a failed consume 500s the webhook so Stripe replays it — a retry can never strand a code. All 3 RPCs are service_role-only (an authenticated grant would let any signed-in user burn capacity via raw PostgREST), so checkout resolves the service client for catalog-code orders; welcome and no-code paths never touch it.

The concurrent-welcome race left over from #25 closes with a partial unique index — 1 WELCOME row per owner; the loser's 23505 maps to a 400 (welcome_in_use), and deleting the abandoned row frees the slot. Restore-on-abandon moved from cleanupProjectArtifacts into the DELETE route, keyed on the delete-returning row so concurrent deletes can't double-decrement; a crash between delete and restore leaks 1 hold, recoverable by recomputing reserved_count from pending applied_coupon_code rows. D-floor-private also shipped: a creation-only allow_below_floor flag (private codes only, by CHECK) drops the floor to 0 in computeOrderPrice, and checkout rejects totals under Stripe's 50-cent minimum and releases the hold — no free-order path.

Applied to the remote (20260715_consume_discount_codes, pre-flight and advisors clean); verified by the 758-test suite, lint, and build. Residuals: abandoned-but-undeleted pending checkouts hold capacity until deleted (a sweep is a #27 candidate), and a #43 direct insert can stamp a code without a hold (griefing-only; the DB floor belongs to #42/#43). The #24 receipt email must land after the must-500 consume in the webhook.
