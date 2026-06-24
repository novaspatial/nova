-- Studio-side archive flag for projects.
-- When set, a project is hidden from the main studio dashboard and surfaced
-- on the dedicated /portal/archived page. Archiving is reversible (unarchive
-- clears archived_at) and does not affect the client's view of the project.
alter table public.projects
  add column archived_at timestamptz;

-- Speeds up the archived / non-archived split on the studio dashboard.
create index if not exists projects_archived_at_idx
  on public.projects (archived_at);
