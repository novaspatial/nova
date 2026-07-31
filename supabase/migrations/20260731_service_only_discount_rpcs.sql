-- Service-only grants for the last client-reachable discount RPCs (#59
-- item 4), extending the 20260715 catalog posture to the first-mix pair
-- and the lookup. Two problems with the 20260702 state:
--
-- 1. The identity guards deliberately pass when auth.uid() IS NULL
--    ("service contexts") — but an *anon* PostgREST caller also has a null
--    uid, and both uuid functions were EXECUTE-able by anon (Supabase's
--    default privileges auto-grant anon/authenticated/service_role on new
--    functions; 20260422 never revoked them). An unauthenticated caller
--    could burn any client's welcome flag (reserve with an arbitrary uuid)
--    or re-arm one (restore; the consumed-check only blocks re-arming
--    after a *paid* discounted order).
-- 2. lookup_discount_code granted to authenticated is a per-guess catalog
--    oracle (active flag, counters, allow_below_floor, expiry) around the
--    validate route's deliberate enumeration posture.
--
-- The app now calls all three on the service client only (orderDiscount.ts
-- since this unit), so the session-caller path these guards served no
-- longer exists. ACLs are the first fence; the in-body guards below are
-- the drift-proof floor — a future DROP+CREATE re-opens the default
-- EXECUTE grants (the hazard 20260715 documents), but the guard survives.
--
-- DEPLOY ORDER: the code that moves these calls onto the service client
-- MUST be serving before this migration applies — under the old code the
-- revoke 500s every no-code checkout. A code rollback after this applies
-- must be paired with the down snippet:
-- -- down:
-- -- grant execute on function public.reserve_first_mix_discount(uuid) to authenticated, anon;
-- -- grant execute on function public.restore_first_mix_discount(uuid) to authenticated, anon;
-- -- grant execute on function public.lookup_discount_code(text) to authenticated;

-- --- 1a. reserve: system-managed (20260715 guard shape). p_user_id is
-- trusted at this boundary — it only ever arrives from requireApiUser()'s
-- verified session id on the checkout route; no in-DB validation is
-- possible for an identityless service caller. The UPDATE stays
-- self-limiting: it matches only the row that still holds the flag.
create or replace function public.reserve_first_mix_discount(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved boolean;
begin
  if (select auth.uid()) is not null
     and not exists (
       select 1 from profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'first-mix holds are system-managed'
      using errcode = '42501';
  end if;

  update profiles
    set first_mix_discount = false
    where id = p_user_id and first_mix_discount = true
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- --- 1b. restore: same guard, and the consumed-check stays verbatim — it
-- brakes caller bugs regardless of identity (once ANY paid project used
-- the discount, the one-shot can never be re-armed).
create or replace function public.restore_first_mix_discount(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and not exists (
       select 1 from profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'first-mix holds are system-managed'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from projects
    where owner_id = p_user_id
      and discount_applied = true
      and paid_at is not null
  ) then
    raise exception 'discount already consumed by a paid order'
      using errcode = '42501';
  end if;

  update profiles set first_mix_discount = true where id = p_user_id;
end;
$$;

-- --- 2. One uniform grant model across all six discount functions:
-- service_role only. public/anon on lookup were already revoked in
-- 20260715; re-revoking is idempotent and keeps this block self-contained.
revoke execute on function public.reserve_first_mix_discount(uuid) from public;
revoke execute on function public.reserve_first_mix_discount(uuid) from anon;
revoke execute on function public.reserve_first_mix_discount(uuid) from authenticated;
grant execute on function public.reserve_first_mix_discount(uuid) to service_role;

revoke execute on function public.restore_first_mix_discount(uuid) from public;
revoke execute on function public.restore_first_mix_discount(uuid) from anon;
revoke execute on function public.restore_first_mix_discount(uuid) from authenticated;
grant execute on function public.restore_first_mix_discount(uuid) to service_role;

revoke execute on function public.lookup_discount_code(text) from public;
revoke execute on function public.lookup_discount_code(text) from anon;
revoke execute on function public.lookup_discount_code(text) from authenticated;
grant execute on function public.lookup_discount_code(text) to service_role;
