-- #47: the SELECT policy was `using (true)` on public — anon could read
-- every future client's email/role/first_mix_discount. Restrict to: your
-- own row, any row when the requester is studio, and studio rows for any
-- signed-in user. Anonymous sessions read nothing (blog authorship comes
-- from the static team registry, never from profiles).
--
-- The self clause is load-bearing: every `role = 'studio'` subquery in
-- the schema's other policies reads the invoker's OWN profiles row under
-- RLS — drop it and studio silently degrades to client everywhere. The
-- studio-row clause keeps comment-author embeds rendering Studio names /
-- badges for Clients on the Listen page (PostgREST embeds null out
-- silently when RLS filters a row). The requester-is-studio clause uses
-- is_studio() from 20260730_fence_profile_role.sql — an inline profiles
-- subquery here would recurse (42P17).
drop policy "Public profiles are viewable by everyone" on profiles;
create policy "Profiles visible to self and studio"
  on profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or role = 'studio'
    or public.is_studio()
  );
