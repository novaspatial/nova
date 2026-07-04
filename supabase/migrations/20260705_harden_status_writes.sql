-- Role-fence for projects.status transitions (issue #34).
--
-- The client UPDATE policy (20260303) is row-scoped but column-agnostic, so
-- before this migration a client could set status to any CHECK-allowed value
-- straight through PostgREST: drag a delivered project back to in_review, or
-- self-promote pending_payment -> uploading and upload stems without paying
-- (the stem gate reads only status). This trigger is the enforcement floor
-- (ADR-0002); the full role-aware transition table lives in the app
-- (src/lib/portal/workflow.ts `canTransition`) and stays the single source
-- of workflow truth.
--
-- Fence rules, mirroring the 20260702 order-fields freeze pattern:
--   * service contexts pass (auth.uid() is null — Stripe webhook);
--   * studio profiles pass (their jumps are app-guarded, and the DB stays a
--     deliberate escape hatch for manual corrections);
--   * clients may only submit their stems: uploading -> in_review.
--
-- UPDATE-only by design: the client-INSERT forgery gap (a client inserting a
-- row born past pending_payment with a forged paid_at) is tracked separately
-- and must not be fenced here — the dev-bypass checkout legitimately inserts
-- born-uploading rows with a client session.
create or replace function public.enforce_status_write_roles()
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
  if old.status = 'uploading' and new.status = 'in_review' then
    return new;
  end if;
  raise exception 'project status can only be changed by studio users (clients may only submit an uploading project for review)'
    using errcode = '42501';
end;
$$;

create trigger projects_enforce_status_write_roles
  before update of status
  on public.projects
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_status_write_roles();
