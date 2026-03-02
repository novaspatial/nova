-- Create project-deliverables bucket
insert into storage.buckets (id, name, public)
values ('project-deliverables', 'project-deliverables', false)
on conflict (id) do nothing;

-- Policy to allow authenticated users to view deliverables
create policy "Project deliverables viewable by authenticated users"
  on storage.objects for select to authenticated
  using ( bucket_id = 'project-deliverables' );

-- Policy to allow authenticated users to upload deliverables (studio uses signed URLs)
create policy "Project deliverables insertable by authenticated users"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'project-deliverables' );

-- Policy to allow overwriting deliverables (for re-uploads via upsert)
create policy "Project deliverables updatable by authenticated users"
  on storage.objects for update to authenticated
  using ( bucket_id = 'project-deliverables' );
