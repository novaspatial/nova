-- Migrate syncing/synced statuses before dropping constraint
update public.project_files
  set upload_status = 'uploaded'
  where upload_status in ('syncing', 'synced');

-- Remove Samply-specific columns from projects
alter table public.projects
  drop column if exists samply_project_id,
  drop column if exists samply_player_id;

-- Remove Samply-specific column from project_files
alter table public.project_files
  drop column if exists samply_file_id;

-- Update upload_status check constraint to remove syncing/synced
alter table public.project_files
  drop constraint if exists project_files_upload_status_check;

alter table public.project_files
  add constraint project_files_upload_status_check
  check (upload_status in ('pending', 'uploading', 'uploaded', 'failed'));

-- Remove Samply-specific column from project_comments
alter table public.project_comments
  drop column if exists samply_comment_id;
