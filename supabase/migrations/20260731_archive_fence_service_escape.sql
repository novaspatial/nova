-- Bring `enforce_studio_only_archive` back into the fence family (#59).
--
-- Every other fence opens with a null-uid escape so service contexts pass
-- (20260726_system_only_project_inserts, 20260730_fence_paid_project_delete,
-- 20260702's order-fields fence). This one, the oldest of them, does not:
-- `not exists (... id = null ...)` is true for a service caller, so any
-- service-role UPDATE touching archived_at raises 42501 with a message
-- blaming the caller for not being studio.
--
-- Latent today — only the studio archive route writes the column, on a
-- session client — but it is a trap for the first back-office or cron
-- tool that needs to archive something, and an inconsistent family is
-- harder to reason about than either rule alone. Pure widening for
-- service contexts; client behaviour is byte-identical.
--
-- The trigger is untouched (same function name, same signature), so no
-- drop/recreate and no ACL churn.

create or replace function public.enforce_studio_only_archive()
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
    raise exception 'archived_at can only be changed by studio users'
      using errcode = '42501'; -- insufficient_privilege -> HTTP 403
  end if;
  return new;
end;
$$;
