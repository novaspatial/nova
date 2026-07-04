Discount-codes catalog — studio admin CRUD (S3)

Date: 2026-07-04.

Built the admin-tool vertical for discount codes: a `discount_codes` table (percent and fixed kinds, expiry, usage limit, single-use, mutually-exclusive new/returning audience flags, referral attribution, public/private scope matching the pricing module's stacking semantics) with studio-only RLS, applied to the remote and verified. Code names are normalized to uppercase and enforced by a DB CHECK.

Studio API routes handle create (409 on duplicates), list, and expire/reactivate; value and kind edits are deliberately unsupported so a code's meaning never changes after it circulates — a new code is issued instead. The admin page at `/blog/admin/discount-codes` inherits the existing studio-only layout guard and robots disallow, and pairs the generation form with the codes list (status pills for active/expired/disabled, per-row deactivate). Linked from the blog admin header.

26 new tests (validation, duplicate conflict, 403/401, deactivate, UI render/create/error); full suite 503, lint/types/build clean. As scoped in the issue, the table is client-inert until S4b (#25) wires redemption at checkout; single-use consumption timing stays with D6 (S5 #26).
