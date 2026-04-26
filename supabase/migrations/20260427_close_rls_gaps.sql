-- Close the RLS gap on project_comment_attachments: SELECT and INSERT
-- policies were declared in 20260418_add_comment_attachments.sql but DELETE
-- was missing, so the table fell back to deny-all and the comment-delete
-- cascade was the only way to remove an attachment row.
--
-- Mirror the comment-delete rule from 20260419: the comment's author may
-- remove their own attachments, and any studio member may remove any
-- attachment on a project they can see.
--
-- No UPDATE policy is added on purpose: attachment rows describe an
-- immutable storage object (file_name, file_size, mime_type, storage_path
-- are captured once at upload), so leaving UPDATE deny-all is correct.
--
-- profiles is intentionally NOT given a DELETE policy: the table cascades
-- from auth.users on delete, which is the only supported account-removal
-- path. Allowing direct profile deletion would let a user orphan their
-- auth row and reach a broken state.
create policy "Authors or studio delete comment attachments"
  on public.project_comment_attachments for delete using (
    exists (
      select 1 from public.project_comments c
      where c.id = project_comment_attachments.comment_id
      and (
        c.author_id = auth.uid()
        or exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'studio'
        )
      )
    )
  );
