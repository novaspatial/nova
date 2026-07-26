-- System-only projects INSERTs (issues #42/#43) — replaces the 20260708
-- fence. That fence let client sessions create rows as long as they were
-- born unpaid pending_payment; both residuals its own header tracked live
-- inside that allowance:
--   * #42: deleting a paid project (allowed since 20260313) frees its
--     UNIQUE stripe_payment_intent_id (20260422); a client could
--     PostgREST-INSERT a fresh same-size pending_payment row re-attaching
--     the succeeded intent id, and the payment-status poll would confirm
--     it paid whenever the intent's best-effort project_id metadata patch
--     had failed (the cross-checks pass on absent metadata).
--   * #43: nothing bounded direct INSERT volume (the checkout route's
--     3/min limit is app-layer), consent fields could be born null, rows
--     could be born archived/deleted, and (since #26) a row could stamp
--     applied_coupon_code without a reservation hold — consume would later
--     burn capacity that was never reserved.
--
-- The checkout route's Stripe-branch insert moved to the service client in
-- the same change (the dev-bypass insert has run there since 20260708), so
-- the app no longer has ANY client-session projects INSERT. The floor can
-- now state the real invariant instead of policing row shape: project rows
-- are born only from system (service/definer) or studio writes. With the
-- UPDATE path frozen since 20260702 (widest 20260724), no unprivileged
-- writer of stripe_payment_intent_id remains — which closes #42 without an
-- intent-tombstone table — and every #43 vector (rate bypass, null
-- consent, born-archived, hold-less coupon) required the INSERT this fence
-- now refuses.
--
-- Same escape hatches as the sibling fences (20260625 archive, 20260702/
-- 20260724 order fields, 20260705 status, 20260726 purge stamps): service
-- contexts pass (auth.uid() is null — both checkout branches), studio
-- profiles pass (the manual-correction hatch; the surviving 20260228
-- INSERT policy's WITH CHECK (auth.uid() = owner_id) still binds even a
-- studio PostgREST insert to rows it owns). Everyone else gets a
-- self-explanatory 42501.
--
-- Deliberately NOT done here:
--   * The 20260228 "Clients create own projects" INSERT policy stays — the
--     trigger is the one fence pattern audited across the siblings, and
--     the policy keeps the owner_id binding as a second layer under the
--     studio hatch.
--   * Consent stays a route concern: TERMS_VERSION is a deploy-time
--     constant the DB cannot know, and the route's version-echo equality
--     is the actual gate — with client inserts gone, every surviving row
--     necessarily passed it.
--   * The rate limit stays app-layer in the route: with no client INSERT
--     path there is no DB-reachable volume left to bound.

drop trigger if exists projects_enforce_unpaid_client_inserts on public.projects;
drop function if exists public.enforce_unpaid_client_inserts();

create or replace function public.enforce_system_only_project_inserts()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'studio'
  ) then
    return new;
  end if;
  raise exception 'projects are created by the payment system (use the checkout endpoint)'
    using errcode = '42501'; -- insufficient_privilege -> HTTP 403
end;
$$;

create trigger projects_enforce_system_only_inserts
  before insert
  on public.projects
  for each row
  execute function public.enforce_system_only_project_inserts();
