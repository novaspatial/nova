# RLS-first authorization

Authorization is enforced primarily by Postgres Row Level Security policies defined in the migrations; the API-layer role checks (`requireApiProfile`, `requireApiStudioUser`, project-visibility helpers) are defense-in-depth and exist to return clean HTTP error codes, not as the sole gate.

We chose this because the same data is reached from server components, route handlers, and (potentially) the browser client, and a single database-level policy is harder to bypass than scattered app checks. The trade-off: authorization logic lives in SQL, so it's less visible to someone reading only TypeScript, and every schema change must update policies in lockstep.

Consequence: never rely on an app-layer check alone — if you add or change access to a table, add or change its RLS policy too (see `20260427_close_rls_gaps.sql` for why gaps matter). The service-role client deliberately bypasses RLS and must only be used in sessionless server code (the Stripe webhook).
