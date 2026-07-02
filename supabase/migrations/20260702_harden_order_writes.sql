-- RLS-first hardening for the priced checkout (S1 #16), following the
-- 20260625 archive pattern. Two gaps, both raised in the S1 review:
--
-- 1. The first-mix RPCs (20260422) are SECURITY DEFINER and granted to
--    `authenticated` with no identity check: any signed-in user could burn a
--    victim's discount (reserve with an arbitrary uuid) or re-arm their own
--    after consuming it (restore after paying). Under per-song pricing a
--    restored 50% code is worth up to $800 on an 8-song order, so this
--    needed a DB-side floor.
--
-- 2. The client UPDATE policy on projects (20260303) is row-level and
--    column-agnostic, so an owner could rewrite song_count/amount_cents/...
--    after paying — e.g. pay for 1 song, then set song_count to 8 and have
--    the studio read an 8-song workload. Same trigger approach as
--    archived_at (20260625).

-- --- 1a. reserve: an authenticated caller may only act on their own row.
-- Studio profiles may act on behalf of a client; non-user contexts
-- (service role) pass through — auth.uid() is null there.
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
     and (select auth.uid()) <> p_user_id
     and not exists (
       select 1 from profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'cannot reserve another user''s discount'
      using errcode = '42501';
  end if;

  update profiles
    set first_mix_discount = false
    where id = p_user_id and first_mix_discount = true
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- --- 1b. restore: same identity guard, plus a consumed-check — once ANY
-- paid project used the discount, the one-shot can never be re-armed.
-- (Legitimate restores happen only for abandoned/unpaid checkouts: the
-- checkout route's rollback paths and the project DELETE cleanup, both
-- pre-payment. A narrow race remains while a discounted checkout is
-- pending-unpaid; the webhook setting paid_at closes it.)
create or replace function public.restore_first_mix_discount(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and (select auth.uid()) <> p_user_id
     and not exists (
       select 1 from profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'cannot restore another user''s discount'
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

-- --- 2. Freeze the money/order-integrity columns for client callers.
-- Service contexts (Stripe webhook sets paid_at with the service key;
-- auth.uid() is null) and studio profiles pass. reference_tracks and notes
-- stay client-editable — they carry content, not money.
create or replace function public.enforce_studio_only_order_fields()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'studio'
  ) then
    raise exception 'order and payment fields can only be changed by studio users'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger projects_enforce_studio_only_order_fields
  before update of song_count, stem_count, subtotal_cents, amount_cents,
    currency, stripe_payment_intent_id, paid_at, discount_applied
  on public.projects
  for each row
  when (
    old.song_count is distinct from new.song_count
    or old.stem_count is distinct from new.stem_count
    or old.subtotal_cents is distinct from new.subtotal_cents
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.stripe_payment_intent_id is distinct from new.stripe_payment_intent_id
    or old.paid_at is distinct from new.paid_at
    or old.discount_applied is distinct from new.discount_applied
  )
  execute function public.enforce_studio_only_order_fields();
