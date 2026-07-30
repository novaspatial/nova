-- #46: the INSERT floor for project_comments checked only author_id, so
-- any authenticated user could inject a comment into a foreign project
-- via PostgREST (the app's Listen POST validates membership; the DB floor
-- did not). Add the owner-or-studio membership predicate, mirroring this
-- table's own SELECT policy. Deliberately no soft-delete conditions —
-- those flags are app-layer visibility, and a stricter DB rule would
-- change behavior on soft-deleted projects.
drop policy "Project members create comments" on project_comments;
create policy "Project members create comments"
  on project_comments for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from projects p
      where p.id = project_comments.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );
