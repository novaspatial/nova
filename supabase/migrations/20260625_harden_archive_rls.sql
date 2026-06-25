-- Harden the archive feature to RLS-first (issue #12 / S16).
--
-- 20260624 added projects.archived_at with no explicit authorization. Because
-- the client UPDATE policy ("Clients can update their own projects", 20260303)
-- is row-level and column-agnostic (USING auth.uid() = owner_id, no WITH
-- CHECK), a client could set or clear archived_at on their own project through
-- the data API -- hiding it from the studio dashboard, or un-archiving it --
-- bypassing the studio-only archive route entirely.
--
-- Postgres RLS policies cannot compare OLD vs NEW, and in Supabase both
-- clients and studio share the single `authenticated` role, so a column-level
-- GRANT/REVOKE cannot distinguish them either. A BEFORE UPDATE trigger is the
-- RLS-first-compatible enforcement floor: any change to archived_at must come
-- from a studio profile.
--
-- Write posture: studio-only (enforced here at the DB level).
-- Read posture: archived_at stays readable to a project's owner, because the
-- projects SELECT policy is row-level and a single column cannot be hidden
-- from one sub-population of the shared `authenticated` role without splitting
-- it into a separate table. This is acceptable -- archiving does NOT change
-- what the client sees (archived projects remain visible to their owner; the
-- `.is('archived_at', null)` filter is applied only on the studio dashboard,
-- new-count, and the /portal/archived page), so the timestamp carries no
-- client-relevant state. The write restriction is the security floor.

create or replace function public.enforce_studio_only_archive()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
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

-- Fires only when archived_at is in the UPDATE's SET list AND its value
-- actually changes, so a client's legitimate updates (status, notes -- see
-- 20260303) are untouched.
create trigger projects_enforce_studio_only_archive
  before update of archived_at on public.projects
  for each row
  when (old.archived_at is distinct from new.archived_at)
  execute function public.enforce_studio_only_archive();
