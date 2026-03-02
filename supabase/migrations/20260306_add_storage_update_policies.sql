-- Allow updating (overwriting) files in project-uploads (needed for mix re-uploads via upsert)
create policy "Project uploads updatable by authenticated users"
  on storage.objects for update to authenticated
  using ( bucket_id = 'project-uploads' );
