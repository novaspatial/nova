-- Blog posts: admin-authored articles displayed at /blog
-- Replaces the build-time MDX glob loader (src/lib/mdx.ts).
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  body text not null,
  author_key text not null,
  post_date date not null,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_published_at_idx
  on public.blog_posts (published_at desc) where published_at is not null;

alter table public.blog_posts enable row level security;

-- Anyone (including anon) may read published posts. Drafts (published_at is null)
-- are hidden from this policy.
create policy "Anyone reads published posts"
  on public.blog_posts for select
  using (published_at is not null);

-- Studio role may read everything, including drafts, so the admin list works.
create policy "Studio reads all posts"
  on public.blog_posts for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio inserts posts"
  on public.blog_posts for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio updates posts"
  on public.blog_posts for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio deletes posts"
  on public.blog_posts for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );
