-- Single-use / usage-limit code consumption (S5 #26, D6) + the below-floor
-- override (D-floor-private). Closes the two residuals #25 shipped with:
-- codes redeemed without consumption tracking, and the concurrent-WELCOME
-- D5 race.
--
-- Vocabulary (D6): a HOLD (reserved_count, taken at checkout, returned on
-- abandon/delete) is the concurrency mechanism; CONSUMPTION (redeemed_count
-- + a discount_redemptions row, finalized when payment confirms) is the
-- permanent fact. Effective capacity = single_use ? 1 : usage_limit
-- (usage_limit >= 1 by CHECK, so single_use dominates when both are set);
-- null = unlimited. Unlimited codes still hold/consume — one uniform path,
-- and redeemed_count doubles as a usage stat for the admin list.
--
-- Grant model: the three mutating RPCs are EXECUTE-granted to service_role
-- ONLY (plus an in-body guard that survives ACL drift on a future
-- drop/recreate — a drop resets EXECUTE to PUBLIC, see the lookup recreate
-- below). Unlike the first-mix RPCs there is no per-user identity to guard
-- on — any authenticated user is a legitimate reserver of any code at
-- checkout — so an `authenticated` grant would let any signed-in user burn a
-- code's capacity through raw PostgREST /rpc without ever checking out (the
-- #43 class; holds are never released). The checkout route therefore runs
-- the hold on the service client: the verified order, not the session, is
-- the authority (the #41 precedent).

-- --- 1. Capacity counters + the below-floor flag.
-- Counter updates deliberately do not bump updated_at — that column tracks
-- administrative edits, not redemption traffic.
alter table public.discount_codes
  add column reserved_count integer not null default 0
    check (reserved_count >= 0),
  add column redeemed_count integer not null default 0
    check (redeemed_count >= 0),
  add column allow_below_floor boolean not null default false;

-- D-floor-private: only PRIVATE codes may pierce the $225/song floor, and
-- the flag is set at creation only (the admin PATCH surface is
-- active-toggle-only by design, so no freeze trigger is needed).
alter table public.discount_codes
  add constraint discount_codes_below_floor_private_only
  check (not (allow_below_floor and is_public));

-- --- 2. The consumption ledger. project_id is the exactly-once key: the
-- webhook and the payment-status poll can both try to finalize the same
-- order, and Stripe replays events — ON CONFLICT (project_id) DO NOTHING
-- makes every consumer after the first a no-op. `code` has no FK on purpose:
-- an admin hard-delete of a catalog row must not break consume or destroy
-- the audit trail. on delete cascade: deleting a paid project keeps working;
-- the aggregate lives in the counters, the ledger row is expendable audit.
create table public.discount_redemptions (
  project_id uuid primary key references public.projects (id) on delete cascade,
  code text not null,
  user_id uuid not null,
  consumed_at timestamptz not null default now()
);

create index discount_redemptions_code_idx
  on public.discount_redemptions (code);

-- Deny-all RLS except studio reads; writes flow only through the
-- security-definer consume RPC (which, as function owner, is not subject to
-- these policies — same mechanics as the first-mix RPCs updating profiles).
alter table public.discount_redemptions enable row level security;

create policy "Studio reads discount redemptions"
  on public.discount_redemptions for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

-- --- 3. reserve: the atomic hold. A single guarded UPDATE is the
-- compare-and-set (the 20260702 first-mix pattern): concurrent reserves
-- serialize on the row lock and exactly one wins the last unit. Re-checking
-- active/expiry here closes the resolve->reserve TOCTOU (a concurrent
-- deactivate or expiry between the app-side pre-check and the hold).
create or replace function public.reserve_discount_code(p_code text)
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
    raise exception 'discount holds are system-managed'
      using errcode = '42501';
  end if;

  update discount_codes
    set reserved_count = reserved_count + 1
    where code = p_code
      and active
      and (expires_at is null or expires_at > now())
      and (
        (case when single_use then 1 else usage_limit end) is null
        or reserved_count + redeemed_count
           < (case when single_use then 1 else usage_limit end)
      )
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- --- 4. restore: return an unconsumed hold (abandon/delete, pre-payment).
-- greatest(0) floors a stray double-release; there is no consumed-check
-- analog to the first-mix restore because consumed capacity lives in
-- redeemed_count, which this never touches.
create or replace function public.restore_discount_code(p_code text)
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
    raise exception 'discount holds are system-managed'
      using errcode = '42501';
  end if;

  update discount_codes
    set reserved_count = greatest(reserved_count - 1, 0)
    where code = p_code;
end;
$$;

-- --- 5. consume: finalize on confirmed payment (D6), idempotent per
-- project via the ledger PK. Missing row (deleted between claim and
-- consume) and codeless/'WELCOME' rows return silently — WELCOME is not a
-- catalog row; its consumption IS the paid project row (D5 + the index in
-- section 6; the literal mirrors WELCOME_COUPON_CODE, like the CODE_PATTERN
-- CHECK mirror). An unpaid project is a caller bug and raises. The counter
-- move happens only when the ledger insert actually inserted, so replays
-- and the webhook/poll race can never double-count; a 0-row counter match
-- (catalog row hard-deleted) is fine.
create or replace function public.consume_discount_code(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_owner uuid;
  v_paid timestamptz;
  v_inserted integer;
begin
  if (select auth.uid()) is not null
     and not exists (
       select 1 from profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'discount consumption is system-managed'
      using errcode = '42501';
  end if;

  select applied_coupon_code, owner_id, paid_at
    into v_code, v_owner, v_paid
    from projects
    where id = p_project_id;
  if not found then
    return;
  end if;
  if v_code is null or v_code = 'WELCOME' then
    return;
  end if;
  if v_paid is null then
    raise exception 'cannot consume a discount for an unpaid project'
      using errcode = '42501';
  end if;

  insert into discount_redemptions (project_id, code, user_id)
    values (p_project_id, v_code, v_owner)
    on conflict (project_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update discount_codes
      set reserved_count = greatest(reserved_count - 1, 0),
          redeemed_count = redeemed_count + 1
      where code = v_code;
  end if;
end;
$$;

-- --- 6. The WELCOME concurrency floor (the second #25 residual). D5 rejects
-- a welcome code once a PAID project exists, but two concurrent checkouts
-- both pass that check before either pays. At most one WELCOME row — pending
-- or paid — may exist per owner: the second concurrent insert dies here with
-- 23505 and the checkout route maps it to a 400. Deleting an abandoned row
-- frees the slot; a paid row holds it forever (belt, with D5 as braces).
create unique index projects_one_welcome_per_owner
  on public.projects (owner_id)
  where applied_coupon_code = 'WELCOME';

-- --- 7. Widen the catalog lookup with the counters (the resolver's
-- capacity pre-check answers "no longer available" before checkout ever
-- reserves) and the below-floor flag (rides the OrderCode so the client
-- quote and the server charge price identically). A returns-table change
-- needs a drop; the drop resets EXECUTE to PUBLIC, so the full 20260713
-- grant block is re-issued below.
drop function public.lookup_discount_code(text);

create function public.lookup_discount_code(p_code text)
returns table (
  code text,
  kind text,
  value integer,
  is_public boolean,
  single_use boolean,
  usage_limit integer,
  new_clients_only boolean,
  returning_clients_only boolean,
  active boolean,
  expires_at timestamptz,
  reserved_count integer,
  redeemed_count integer,
  allow_below_floor boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select code, kind, value, is_public, single_use, usage_limit,
         new_clients_only, returning_clients_only, active, expires_at,
         reserved_count, redeemed_count, allow_below_floor
  from discount_codes
  where code = p_code
$$;

revoke execute on function public.lookup_discount_code(text) from public;
revoke execute on function public.lookup_discount_code(text) from anon;
grant execute on function public.lookup_discount_code(text) to authenticated, service_role;

-- --- 8. Grants for the mutating trio: service_role only (rationale in the
-- header). The in-body guards above are the drift-proof floor; these ACLs
-- are the first fence.
revoke execute on function public.reserve_discount_code(text) from public;
revoke execute on function public.reserve_discount_code(text) from anon;
revoke execute on function public.reserve_discount_code(text) from authenticated;
grant execute on function public.reserve_discount_code(text) to service_role;

revoke execute on function public.restore_discount_code(text) from public;
revoke execute on function public.restore_discount_code(text) from anon;
revoke execute on function public.restore_discount_code(text) from authenticated;
grant execute on function public.restore_discount_code(text) to service_role;

revoke execute on function public.consume_discount_code(uuid) from public;
revoke execute on function public.consume_discount_code(uuid) from anon;
revoke execute on function public.consume_discount_code(uuid) from authenticated;
grant execute on function public.consume_discount_code(uuid) to service_role;
