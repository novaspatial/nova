-- Authors can remove their own comments; studio members can remove any comment
-- on projects they can see. Relies on ON DELETE CASCADE from
-- project_comment_attachments.comment_id to clean up attachment rows.
create policy "Authors or studio delete comments"
  on project_comments for delete using (
    auth.uid() = author_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'studio')
  );
