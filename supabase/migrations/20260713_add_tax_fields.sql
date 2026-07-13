-- Tax + buyer-location columns for the computed GST/HST checkout (S21 #31).
-- D2 (decided 2026-07-13, recorded in #1): Canadian clients pay GST/HST at
-- the full provincial rate (ON 13, NS 14, NB/NL/PE 15, elsewhere 5% GST; no
-- PST/QST); non-Canadian buyers are zero-rated. Computed in
-- src/lib/stripe/pricing.ts from the billing country + province collected on
-- the order form — not Stripe Tax.
--
-- RLS: projects policies are row-level (20260228 insert / 20260303 update),
-- so the new columns ride them unchanged — same precedent as
-- 20260702_add_order_fields. Nullable: rows created before this migration
-- never had tax computed (their charged amounts contained no tax); a
-- computed-but-untaxed order stores 0, keeping "never computed" (null) and
-- "zero-rated" (0) distinct for #24's receipt.
--
-- The 20260708 INSERT fence is deliberately unchanged: the checkout route
-- writes these columns at insert with the USER session (like amount_cents),
-- so they cannot be forced born-null here. Forged values on a self-inserted
-- unpaid row buy nothing — the PaymentIntent is priced server-side and the
-- freeze below makes the fields immutable once the row exists. Residual: a
-- direct PostgREST insert can stamp arbitrary buyer/tax values on its own
-- unpaid row, consistent with the #43 debt (rate-limit/consent bypass),
-- tracked there.

alter table public.projects
  add column tax_cents integer
    check (tax_cents is null or tax_cents >= 0),
  add column buyer_country text
    check (buyer_country is null or buyer_country in ('CA', 'US', 'OTHER')),
  add column buyer_province text
    check (
      buyer_province is null
      or buyer_province in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT')
    );

-- Pairing: a province is only meaningful for Canada, and a Canadian order
-- must carry one (place-of-supply picks the rate). Vacuously satisfied by
-- legacy all-null rows.
alter table public.projects
  add constraint projects_buyer_province_only_for_ca
    check (buyer_province is null or buyer_country = 'CA'),
  add constraint projects_ca_requires_province
    check (buyer_country is distinct from 'CA' or buyer_province is not null);

-- Freeze the new money/location columns against client rewrites, exactly as
-- 20260704 widened the 20260702 trigger: the function body is generic, so
-- only the trigger's column list + when-clause change.
drop trigger if exists projects_enforce_studio_only_order_fields on public.projects;

create trigger projects_enforce_studio_only_order_fields
  before update of song_count, stem_count, subtotal_cents, amount_cents,
    currency, stripe_payment_intent_id, paid_at, discount_applied,
    terms_accepted_at, terms_version, tax_cents, buyer_country, buyer_province
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
  )
  execute function public.enforce_studio_only_order_fields();
