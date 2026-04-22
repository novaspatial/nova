-- Payment gate for /portal/new: projects start in 'pending_payment' and
-- transition to 'uploading' only after Stripe confirms the charge.

alter table public.projects drop constraint projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in (
    'pending_payment',
    'uploading',
    'in_review',
    'processing',
    'mixing',
    'review',
    'revision',
    'approved',
    'delivered'
  ));

alter table public.projects
  add column stripe_payment_intent_id text unique,
  add column paid_at timestamptz,
  add column amount_cents integer,
  add column currency text default 'usd',
  add column discount_applied boolean not null default false;

create index if not exists projects_stripe_payment_intent_idx
  on public.projects (stripe_payment_intent_id);

-- Atomic reservation: flip first_mix_discount from true -> false for this
-- user and report whether the caller won the race. Prevents concurrent
-- checkout sessions from both getting the discounted price.
create or replace function public.reserve_first_mix_discount(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved boolean;
begin
  update profiles
    set first_mix_discount = false
    where id = p_user_id and first_mix_discount = true
    returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

-- Restore a reservation when a pre-payment project is abandoned. The
-- caller must verify the project had discount_applied=true and paid_at
-- is null before invoking this.
create or replace function public.restore_first_mix_discount(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set first_mix_discount = true where id = p_user_id;
$$;

grant execute on function public.reserve_first_mix_discount(uuid) to authenticated;
grant execute on function public.restore_first_mix_discount(uuid) to authenticated, service_role;
