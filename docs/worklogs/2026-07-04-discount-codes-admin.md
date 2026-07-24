# Discount-codes catalog — studio admin CRUD

Date: 2026-07-04

Goal: give the studio a self-serve tool to mint and manage discount codes, ready for checkout redemption to plug into later.

The discount_codes table covers percent and fixed kinds, expiry, usage limit, single-use, mutually-exclusive new/returning audience flags, referral attribution, and public/private scope matching the pricing module's stacking rules — with studio-only RLS, applied to the remote and verified. Code names normalize to uppercase, enforced by a DB CHECK.

Studio API routes handle create (409 on duplicates), list, and expire/reactivate. Value and kind edits are deliberately unsupported so a code's meaning never changes once it circulates — a new code is issued instead. The admin page at /blog/admin/discount-codes inherits the existing studio-only layout guard and robots disallow, pairing the generation form with the codes list (status pills for active/expired/disabled, per-row deactivate), linked from the blog admin header.

26 new tests (validation, duplicate conflict, 401/403, deactivate, UI render/create/error); suite 503, lint/types/build clean. As scoped in the issue, the table is client-inert until #25 wires redemption at checkout; single-use consumption timing stays with D6 (#26).
