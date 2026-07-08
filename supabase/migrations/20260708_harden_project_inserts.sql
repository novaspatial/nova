-- Role-fence for projects INSERTs — the payment-write hardening pair
-- (issues #40/#41). Closes the client-INSERT forgery gap explicitly
-- tracked in 20260705_harden_status_writes' header: both existing freezes
-- (20260702 order fields, recreated wider in 20260704; 20260705 status)
-- are BEFORE UPDATE only, so a client could PostgREST-INSERT a project
-- born status='uploading' with a forged paid_at and upload stems without
-- paying — the stem gate reads only status.
--
-- The only client-session INSERT path in the app is the checkout route's
-- Stripe branch, which always creates pending_payment rows with no
-- paid_at. The dev-bypass branch's born-uploading $0 insert moved to the
-- service client in the same change (auth.uid() is null there, so it
-- passes this fence like the sibling ones).
--
-- A trigger, not a WITH CHECK on the 20260228 insert policy: the same
-- studio escape hatch as the sibling fences, a self-explanatory 42501
-- instead of a generic row-level-security violation, and one fence
-- pattern to audit across archive/order-fields/status/insert.
--
-- Deliberately NOT pinned at insert:
--   * discount_applied — the checkout route legitimately sets it via the
--     client session after reserve_first_mix_discount, and a forged `true`
--     on an unpaid row is near-harmless: restore_first_mix_discount's
--     consumed-check (20260702) refuses to re-arm once any paid project
--     used the discount.
--   * stripe_payment_intent_id — the Stripe branch attaches it at insert
--     with the client session, so it cannot be forced null here. Residual:
--     deleting a paid project frees its unique intent id (20260422) for
--     re-attachment to a fresh pending_payment row; the payment-status
--     route's metadata cross-checks (project_id, song_count) bound this to
--     a same-size resurrection when the intent's project_id patch failed,
--     and a DB-level floor is tracked as a follow-up issue (#42).
--   * amount/order fields — forged numbers on an unpaid row buy nothing:
--     intents are priced server-side, and the 20260702 freeze makes the
--     fields immutable once the row exists.
create or replace function public.enforce_unpaid_client_inserts()
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
  if new.status = 'pending_payment' and new.paid_at is null then
    return new;
  end if;
  raise exception 'projects must be created as pending_payment with no payment recorded (payment facts are written by the payment system)'
    using errcode = '42501';
end;
$$;

create trigger projects_enforce_unpaid_client_inserts
  before insert
  on public.projects
  for each row
  execute function public.enforce_unpaid_client_inserts();
