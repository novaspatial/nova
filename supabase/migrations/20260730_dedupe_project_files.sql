-- #57: nothing stopped two project_files rows pointing at the same storage
-- object, so a re-uploaded mix showed up twice on the Listen page while the
-- object itself was replaced in place. The register seam now reuses the
-- existing row; this index makes that the DB's invariant too, so a future
-- caller can't reintroduce the duplicate.
create unique index if not exists project_files_project_storage_path_key
  on public.project_files (project_id, storage_path);
