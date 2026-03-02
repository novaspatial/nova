-- Create project-uploads bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('project-uploads', 'project-uploads', false)
on conflict (id) do nothing;



-- Policy to allow authenticated users to view files in project-uploads
create policy "Project uploads viewable by authenticated users"
  on storage.objects for select to authenticated
  using ( bucket_id = 'project-uploads' );

-- Policy to allow authenticated users to upload files to project-uploads
-- (Required for generating signed upload URLs on the server as the authenticated user)
create policy "Project uploads insertable by authenticated users"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'project-uploads' );
