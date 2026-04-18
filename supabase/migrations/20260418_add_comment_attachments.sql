-- Allow attachment-only comments (body is optional when the comment carries files).
-- The "body or attachments must be present" invariant is enforced at the API layer
-- (check constraints cannot reference other tables in Postgres).
alter table public.project_comments
  alter column body drop not null;

-- Attachments attached to a comment (images, documents, etc.)
create table public.project_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.project_comments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create index project_comment_attachments_comment_id_idx
  on public.project_comment_attachments (comment_id);

alter table public.project_comment_attachments enable row level security;

create policy "Project members see comment attachments"
  on project_comment_attachments for select using (
    exists (
      select 1 from projects p
      where p.id = project_comment_attachments.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

create policy "Project members create comment attachments"
  on project_comment_attachments for insert with check (
    exists (
      select 1 from project_comments c
      where c.id = project_comment_attachments.comment_id
      and c.author_id = auth.uid()
      and c.project_id = project_comment_attachments.project_id
    )
  );
