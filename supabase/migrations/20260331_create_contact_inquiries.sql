create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Allow anonymous inserts (public contact form)
alter table public.contact_inquiries enable row level security;

create policy "Anyone can submit a contact inquiry"
  on public.contact_inquiries
  for insert
  with check (true);
