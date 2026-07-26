-- Delivery anchor + purge tombstone (issue #27 / S18; D7, D7b).
--
-- delivered_at: stamped by the studio PATCH route exactly when status enters
-- 'delivered' (the transition point the #34 guards made explicit). It anchors
-- the 90-day retention window the T&C promises.
-- files_purged_at: the D7b tombstone. The Vercel Cron purge removes stem +
-- mix storage objects and their project_files rows, then stamps this; the
-- project row itself stays — it is the order/consent/tax record (D1).
--
-- Write posture mirrors 20260625 (archive) and 20260705 (status fence):
--   * service contexts pass (auth.uid() is null — the purge cron runs
--     sessionless on the service client);
--   * studio profiles pass (delivered_at arrives via the studio-gated PATCH;
--     the DB stays the deliberate escape hatch for manual corrections);
--   * clients are rejected — neither stamp is theirs to move, in either
--     direction (clearing delivered_at would exempt a project from the purge;
--     forging it would purge their own files early, and clearing
--     files_purged_at would make the cron re-sweep a purged project).
--
-- UPDATE-only by design, like the status fence: the 20260708 INSERT fence
-- already forces client-created rows to be born pending_payment, and the
-- purge selection requires status = 'delivered', so a forged INSERT-time
-- stamp is inert.

alter table public.projects
  add column delivered_at timestamptz,
  add column files_purged_at timestamptz;

create or replace function public.enforce_lifecycle_stamp_roles()
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
  raise exception 'delivered_at and files_purged_at can only be changed by studio users'
    using errcode = '42501'; -- insufficient_privilege -> HTTP 403
end;
$$;

create trigger projects_enforce_lifecycle_stamp_roles
  before update of delivered_at, files_purged_at
  on public.projects
  for each row
  when (
    old.delivered_at is distinct from new.delivered_at
    or old.files_purged_at is distinct from new.files_purged_at
  )
  execute function public.enforce_lifecycle_stamp_roles();
