-- Support for the orphan sweeper (#59 item 8): a registration timestamp
-- the sweep can key on, and a service-only listing of comment-attachment
-- objects that never became rows.

-- --- 1. When the current pending registration was made.
--
-- `created_at` cannot serve: since #57 made registration idempotent per
-- (project_id, storage_path), a re-upload UPDATEs an existing row back to
-- 'pending' without touching any timestamp. A sweep keyed on created_at
-- would see a month-old row that a client started re-uploading minutes
-- ago as stale and delete both the row and the object underneath the
-- upload in flight. This column is stamped on every registration, so
-- "pending since" means what the sweep needs it to mean.
--
-- Backfilling to now() is the safe default: existing pending rows simply
-- become sweepable one threshold from now rather than immediately.
alter table public.project_files
  add column if not exists upload_registered_at timestamptz not null default now();

comment on column public.project_files.upload_registered_at is
  'When the current upload registration was made (stamped on re-register too, unlike created_at). The orphan sweeper keys its staleness cutoff on this.';

-- --- 2. Comment-attachment objects with no row.
--
-- Comment attachments are signed under a fresh UUID prefix and get NO
-- database row until the listen POST submits the comment (storage.ts), so
-- an abandoned compose leaves an object nothing references. They are
-- invisible to any SQL sweep over the app's own tables, and project
-- deletion misses them too — projectCleanup collects paths from the child
-- tables, and these have no child row by construction.
--
-- An anti-join against storage.objects is exact and single-shot, where a
-- paginated bucket walk through the storage API would be neither. The
-- function is SECURITY DEFINER because storage.objects is not reachable
-- from PostgREST, and service_role-only per the 20260715 grant model,
-- with the in-body guard as the drift-proof floor.
create or replace function public.list_orphan_comment_attachments(
  p_cutoff timestamptz,
  p_limit integer
)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not exists (
       select 1 from public.profiles
       where id = (select auth.uid()) and role = 'studio'
     )
  then
    raise exception 'orphan sweeps are system-managed'
      using errcode = '42501';
  end if;

  return query
    select o.name
    from storage.objects o
    where o.bucket_id = 'project-uploads'
      -- {owner}/{project}/comments/{attachmentId}/{file}
      and o.name like '%/comments/%'
      and o.created_at <= p_cutoff
      and not exists (
        select 1
        from public.project_comment_attachments a
        where a.storage_path = o.name
      )
    order by o.created_at
    limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.list_orphan_comment_attachments(timestamptz, integer) from public;
revoke execute on function public.list_orphan_comment_attachments(timestamptz, integer) from anon;
revoke execute on function public.list_orphan_comment_attachments(timestamptz, integer) from authenticated;
grant execute on function public.list_orphan_comment_attachments(timestamptz, integer) to service_role;
