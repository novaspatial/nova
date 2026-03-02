-- Add role column to existing profiles table
alter table public.profiles
  add column role text not null default 'client'
  check (role in ('client', 'studio'));

-- Projects: one per client mixing engagement
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'mixing', 'review', 'revision', 'approved', 'delivered')),
  samply_project_id text,
  samply_player_id text,
  format text not null default 'atmos'
    check (format in ('atmos', 'binaural', 'both')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Project files: stems, master refs, and deliverables
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  file_type text not null default 'stem'
    check (file_type in ('stem', 'master_ref', 'deliverable')),
  storage_path text not null,
  samply_file_id text,
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'uploaded', 'syncing', 'synced', 'failed')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

-- Comments: local cache of Samply timestamped comments
create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  samply_comment_id text,
  author_id uuid not null references public.profiles(id),
  body text not null,
  timestamp_ms integer,
  parent_id uuid references public.project_comments(id),
  created_at timestamptz default now()
);

-- Deliverables: approved final files ready for download
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  storage_path text not null,
  format text not null
    check (format in ('adm_bwf', 'binaural_wav', 'dolby_atmos_adm')),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- RLS: projects
alter table public.projects enable row level security;

create policy "Clients see own projects, studio sees all"
  on projects for select using (
    auth.uid() = owner_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'studio')
  );

create policy "Clients create own projects"
  on projects for insert with check (auth.uid() = owner_id);

create policy "Studio can update any project"
  on projects for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'studio')
  );

-- RLS: project_files
alter table public.project_files enable row level security;

create policy "Project members see files"
  on project_files for select using (
    exists (
      select 1 from projects p
      where p.id = project_files.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

create policy "Project members upload files"
  on project_files for insert with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from projects p
      where p.id = project_files.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

create policy "Project members update own files"
  on project_files for update using (
    exists (
      select 1 from projects p
      where p.id = project_files.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

-- RLS: project_comments
alter table public.project_comments enable row level security;

create policy "Project members see comments"
  on project_comments for select using (
    exists (
      select 1 from projects p
      where p.id = project_comments.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

create policy "Project members create comments"
  on project_comments for insert with check (
    auth.uid() = author_id
  );

-- RLS: deliverables
alter table public.deliverables enable row level security;

create policy "Project members see deliverables"
  on deliverables for select using (
    exists (
      select 1 from projects p
      where p.id = deliverables.project_id
      and (p.owner_id = auth.uid()
           or exists (select 1 from profiles where id = auth.uid() and role = 'studio'))
    )
  );

create policy "Studio creates deliverables"
  on deliverables for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'studio')
  );
