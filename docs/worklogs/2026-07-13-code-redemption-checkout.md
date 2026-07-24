# Code redemption at checkout

Date: 2026-07-13

Goal: let clients actually redeem discount codes (#25) — typed into the order form, priced into the live quote, and re-verified server-side so the charge never trusts the browser.

The order form gained a code field; the live quote prices with the code a new authed validate endpoint resolves, and checkout re-validates everything from scratch — catalog lookup, active/expiry, and the D5 audience rule (returning = any prior paid project). The charge is the recomputed capped/floored total, and the code persists as projects.applied_coupon_code. 1 migration (20260713) adds the column, widens the freeze trigger, and creates the narrow lookup_discount_code RPC — with an explicit revoke, since Postgres grants EXECUTE to PUBLIC by default.

All resolution lives inside the #38 seam: reserveOrderDiscount takes the submitted code, a submitted code skips the first-mix reserve (1 code per order), and rejections map to 400 instead of 500. Per D11 the welcome offer is code-based: the welcome code resolves in code from WELCOME_DISCOUNT_PCT, never a catalog row, so charge and copy can't drift; the dormant flag path stays as the no-code fallback, and welcome/catalog orders persist discount_applied=false so the flag's restore and consumed-check semantics stay exact.

2 residuals documented, not built: concurrent welcome-code checkouts can both pass eligibility before either pays, and single-use/usage-limit codes redeem without being consumed — so distribute no codes before #26. #26 plugs in at the marked points: the hold inside reserveOrderDiscount, the row-based restore keyed on applied_coupon_code, the webhook finalize reading the code from intent metadata, and the floor override into computeOrderPrice.
