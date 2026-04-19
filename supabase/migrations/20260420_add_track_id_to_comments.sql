-- Scope every comment to a specific mix track. Legacy comments are discarded
-- because they were project-wide and can't be unambiguously mapped to a track.
delete from public.project_comment_attachments;
delete from public.project_comments;

alter table public.project_comments
  add column track_id uuid not null references public.project_files(id) on delete cascade;

create index project_comments_track_id_idx
  on public.project_comments (track_id);
