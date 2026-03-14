-- Allow clients to delete their own projects and studio users to delete any project.
create policy "Clients delete own projects, studio deletes all"
  on public.projects for delete
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

-- Allow project owners or studio users to remove project upload objects.
create policy "Project uploads deletable by authenticated users"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-uploads'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (
        select 1 from public.profiles where id = auth.uid() and role = 'studio'
      )
    )
  );

-- Allow project owners or studio users to remove deliverable objects.
create policy "Project deliverables deletable by authenticated users"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-deliverables'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (
        select 1 from public.profiles where id = auth.uid() and role = 'studio'
      )
    )
  );
