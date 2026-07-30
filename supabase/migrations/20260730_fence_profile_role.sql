-- #44: any client could set their own profiles.role = 'studio' (or re-arm
-- first_mix_discount, or rewrite the email receipts are sent to) through
-- PostgREST — the UPDATE policy pins only the row, never the columns. Two
-- layers, per the repo's fence doctrine:
--
-- 1) Grant surface: the app's only session write to profiles is
--    display_name/avatar_url/updated_at (ProfileForm). Replace the blanket
--    table-level UPDATE grant with exactly those columns. (A bare column
--    REVOKE would be a no-op — column privileges were never granted
--    individually; the table-level grant covers them all.)
-- 2) Trigger fence (the 20260705 pattern): service contexts and studio
--    profiles pass; any other change to role / first_mix_discount / email
--    raises 42501. Defense-in-depth against future grant drift.
--
-- The SECURITY DEFINER RPCs (reserve/restore_first_mix_discount) and
-- handle_new_user run as the function owner: unaffected by both layers.

-- is_studio(): profiles' own policies can't subquery profiles (42P17
-- infinite recursion), so the studio check lives in a SECURITY DEFINER
-- helper. Also used by 20260730_restrict_profile_reads.sql and available
-- to future fences.
create or replace function public.is_studio()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'studio'
  );
$$;

revoke update on table public.profiles from authenticated, anon;
grant update (display_name, avatar_url, updated_at)
  on table public.profiles to authenticated;

create or replace function public.enforce_profile_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if public.is_studio() then
    return new;
  end if;
  raise exception 'profiles.role, first_mix_discount, and email can only be changed by studio or service contexts'
    using errcode = '42501';
end;
$$;

create trigger profiles_enforce_privileged_columns
  before update of role, first_mix_discount, email
  on public.profiles
  for each row
  when (
    old.role is distinct from new.role
    or old.first_mix_discount is distinct from new.first_mix_discount
    or old.email is distinct from new.email
  )
  execute function public.enforce_profile_privileged_columns();
