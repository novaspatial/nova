# System-only project inserts

Date: 2026-07-26

Closed the 2 leftover holes from the #40/#41 payment hardening (#42, #43). Both came from one allowance: the database let a signed-in client create project rows directly, as long as they were born unpaid. That permitted 2 abuses — re-attaching a deleted paid order's Stripe payment id to a fresh row so it comes back "paid" without a new charge (#42), and minting rows that skip checkout entirely: no rate limit, no recorded consent, born hidden, or carrying a discount code that was never reserved (#43).

The fix removes the allowance instead of patching each abuse. The checkout API now inserts project rows with the server's privileged connection (13908d3), and a new database rule (20260726_system_only_project_inserts, applied) rejects any project insert from a client session outright — orders can only be born through checkout. Consent and the 3/min limit deliberately stay checks inside the route, since every row now has to pass through it. One operational change: the service key is required for every checkout, not just some paths (production already had it).

Verified on the live database, not just in mocks: a simulated client insert is refused with the new 42501 error, a server insert still passes, the old rule is gone. Suite 861, lint green. Deploy order was honored — code deployed first, database rule applied after — so no live checkout ever ran old code against the new rule.
