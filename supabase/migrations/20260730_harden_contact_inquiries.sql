-- #51: the public contact endpoint had no abuse bounds, and the table
-- accepted anonymous INSERTs directly (the advisor's rls_policy_always_true
-- finding). Two changes:
--
-- 1) `ip_hash` — a SHA-256 of the client IP, never the address itself, so
--    the route can rate-limit per sender. Nullable: a request without a
--    forwarded IP still gets through, bounded by the per-email limit.
-- 2) Inquiries become a system write. Dropping the blanket INSERT policy
--    leaves no policy at all for anon/authenticated (deny-all), while the
--    service client the route now uses bypasses RLS — so a row can only be
--    born through the endpoint that applies the caps, validation, and rate
--    limit. There is still no SELECT policy: only studio/service reads.
alter table public.contact_inquiries
  add column if not exists ip_hash text;

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at desc);

drop policy if exists "Anyone can submit a contact inquiry" on public.contact_inquiries;
