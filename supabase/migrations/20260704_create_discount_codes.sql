-- Discount-codes catalog (S3 #17): schema + studio-only RLS.
--
-- Admin-tool vertical: the studio creates/lists/expires codes; the table is
-- deliberately CLIENT-INERT until S4b (#25) wires redemption at checkout via
-- a narrow server-side path (never a broad client SELECT). Deny-all is the
-- default once RLS is on; only the four studio policies below match.
--
-- Semantics the pricing module (D4) already fixes: percent value is a whole
-- percent (15 = 15%); fixed value is integer cents. is_public maps to the
-- pricing CodeScope — public codes stack with the bulk tier, private codes
-- suppress it. single_use / usage_limit consumption timing is D6 (S5 #26);
-- redemption counting will land with that slice.

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  kind text not null
    check (kind in ('percent', 'fixed')),
  value integer not null
    check (value > 0),
  is_public boolean not null default false,
  single_use boolean not null default false,
  usage_limit integer
    check (usage_limit is null or usage_limit >= 1),
  new_clients_only boolean not null default false,
  returning_clients_only boolean not null default false,
  referral_attribution text,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discount_codes_percent_max check (kind <> 'percent' or value <= 100),
  constraint discount_codes_one_audience check (not (new_clients_only and returning_clients_only))
);

alter table public.discount_codes enable row level security;

create policy "Studio reads discount codes"
  on public.discount_codes for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio inserts discount codes"
  on public.discount_codes for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio updates discount codes"
  on public.discount_codes for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );

create policy "Studio deletes discount codes"
  on public.discount_codes for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );
