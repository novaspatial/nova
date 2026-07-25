-- Remove the dormant deliverables pipeline (#13 closed as already-live).
-- Delivery in practice is mix-type project_files downloaded from the Listen
-- page; public.deliverables and the project-deliverables bucket were never
-- consumed by any UI and hold 0 rows / 0 objects in production.

-- Guards: abort if this ever replays against a database where the pipeline
-- was actually used — a non-empty state means this migration must not run.
do $$
begin
  if exists (select 1 from public.deliverables) then
    raise exception 'public.deliverables is not empty - aborting removal';
  end if;
  if exists (
    select 1 from storage.objects where bucket_id = 'project-deliverables'
  ) then
    raise exception 'project-deliverables bucket is not empty - aborting removal';
  end if;
  if exists (
    select 1 from public.project_files where file_type = 'deliverable'
  ) then
    raise exception 'project_files has deliverable rows - aborting removal';
  end if;
end $$;

-- Dropping the table takes its RLS policies with it ("Project members see
-- deliverables", "Studio creates deliverables", "Studio deletes deliverables";
-- an UPDATE policy never existed). FKs point outward only; nothing references
-- the table.
drop table public.deliverables;

-- storage.objects survives, so its bucket policies drop explicitly
-- (three from 20260305, the delete policy from 20260313).
drop policy "Project deliverables viewable by authenticated users" on storage.objects;
drop policy "Project deliverables insertable by authenticated users" on storage.objects;
drop policy "Project deliverables updatable by authenticated users" on storage.objects;
drop policy "Project deliverables deletable by authenticated users" on storage.objects;

delete from storage.buckets where id = 'project-deliverables';

-- Narrow file_type to the values the portal writes (the 20260304 definition
-- minus 'deliverable'; the guard above proves no row uses it, and add
-- constraint re-validates existing rows anyway).
alter table project_files drop constraint project_files_file_type_check;
alter table project_files add constraint project_files_file_type_check
  check (file_type in ('stem', 'master_ref', 'mix'));
