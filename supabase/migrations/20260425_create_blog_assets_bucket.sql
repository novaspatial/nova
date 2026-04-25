-- blog-assets: public-read storage bucket for inline images embedded in blog posts.
-- Studio is the only role allowed to write. file_size_limit is set well below
-- the Supabase free-tier 50 MB upload ceiling.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-assets',
  'blog-assets',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "Blog assets readable by anyone"
  on storage.objects for select to anon, authenticated
  using ( bucket_id = 'blog-assets' );

create policy "Blog assets writable by studio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'blog-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Blog assets updatable by studio"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'blog-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Blog assets deletable by studio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'blog-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );
