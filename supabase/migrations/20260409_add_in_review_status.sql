-- Add 'in_review' to the project status check constraint
alter table public.projects
  drop constraint projects_status_check;

alter table public.projects
  add constraint projects_status_check
    check (status in ('uploading', 'in_review', 'processing', 'mixing', 'review', 'revision', 'approved', 'delivered'));
