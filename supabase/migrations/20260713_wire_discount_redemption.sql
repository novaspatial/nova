-- Discount-code redemption at checkout (S4b #25): persist the redeemed code
-- on the order row and open the narrow catalog-read path the 20260704
-- migration header reserved for this slice.
--
-- applied_coupon_code holds the normalized code the charge was priced with
-- ('WELCOME' for the code-enforced welcome offer per D11, or a catalog code).
-- Nullable: no-code orders and every pre-#25 row. Distinct from
-- discount_applied, which keeps meaning "the first-mix profile flag was
-- reserved for this row" — restore_first_mix_discount's consumed-check and
-- restoreUnpaidOrderDiscount key off it, and catalog/welcome orders hold
-- nothing in #25 (the single-use hold is #26, per D6).
--
-- The 20260708 INSERT fence is deliberately unchanged: the checkout route
-- stamps this column at insert with the USER session (like amount_cents and
-- tax_cents). A forged value on a self-inserted unpaid row buys nothing —
-- the PaymentIntent is priced server-side and the freeze below makes the
-- column immutable once the row exists. Residual consistent with #43.

alter table public.projects
  add column applied_coupon_code text
    check (
      applied_coupon_code is null
      or applied_coupon_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
    );

-- Freeze the persisted code against client rewrites, exactly as 20260713
-- (tax fields) widened the 20260702 trigger: the function body is generic,
-- so only the trigger's column list + when-clause change.
drop trigger if exists projects_enforce_studio_only_order_fields on public.projects;

create trigger projects_enforce_studio_only_order_fields
  before update of song_count, stem_count, subtotal_cents, amount_cents,
    currency, stripe_payment_intent_id, paid_at, discount_applied,
    terms_accepted_at, terms_version, tax_cents, buyer_country, buyer_province,
    applied_coupon_code
  on public.projects
  for each row
  when (
    old.song_count is distinct from new.song_count
    or old.stem_count is distinct from new.stem_count
    or old.subtotal_cents is distinct from new.subtotal_cents
    or old.amount_cents is distinct from new.amount_cents
    or old.currency is distinct from new.currency
    or old.stripe_payment_intent_id is distinct from new.stripe_payment_intent_id
    or old.paid_at is distinct from new.paid_at
    or old.discount_applied is distinct from new.discount_applied
    or old.terms_accepted_at is distinct from new.terms_accepted_at
    or old.terms_version is distinct from new.terms_version
    or old.tax_cents is distinct from new.tax_cents
    or old.buyer_country is distinct from new.buyer_country
    or old.buyer_province is distinct from new.buyer_province
    or old.applied_coupon_code is distinct from new.applied_coupon_code
  )
  execute function public.enforce_studio_only_order_fields();

-- The narrow server-side catalog read (#17's RLS keeps discount_codes
-- studio-only; redemption must never be a broad client SELECT). Exact match
-- on the app-normalized code; returns only redemption-relevant columns —
-- never referral_attribution or created_by. active/expires_at come back raw
-- so the app-side resolver can answer with a reason-specific message.
create or replace function public.lookup_discount_code(p_code text)
returns table (
  code text,
  kind text,
  value integer,
  is_public boolean,
  single_use boolean,
  usage_limit integer,
  new_clients_only boolean,
  returning_clients_only boolean,
  active boolean,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select code, kind, value, is_public, single_use, usage_limit,
         new_clients_only, returning_clients_only, active, expires_at
  from discount_codes
  where code = p_code
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and unlike
-- the first-mix RPCs this one has no in-body auth guard — without the
-- revoke, anon could probe the catalog through PostgREST /rpc.
revoke execute on function public.lookup_discount_code(text) from public;
revoke execute on function public.lookup_discount_code(text) from anon;
grant execute on function public.lookup_discount_code(text) to authenticated, service_role;
