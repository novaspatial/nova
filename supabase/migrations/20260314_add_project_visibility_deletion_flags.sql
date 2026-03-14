alter table public.projects
  add column client_deleted_at timestamptz,
  add column studio_deleted_at timestamptz;
