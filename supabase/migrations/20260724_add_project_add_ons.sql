-- Order add-ons (S6 #19): the two priced add-ons — extra revision round
-- (+$50) and 48-hour rush (+$149) — selected at order time and persisted on
-- the projects row (D1). Priced in src/lib/stripe/pricing.ts per D4: added
-- AFTER discounts, outside the 35% cap and the $225/song floor, taxed as
-- part of the consideration (D2). 2026-07-14 rulings (recorded in #1/#19):
-- rush is always purchasable (no availability gate), and add-ons are
-- order-time only (post-order extras are invoiced manually per D-revisions).
--
-- One text[] column with a containment check, not two scalar columns: the
-- AddOn union and the checkout wire (OrderInput.addOns) are already
-- array-shaped, and one column absorbs future add-ons without a migration
-- per flag. Nullable with NO default: null = created before add-ons
-- existed; '{}' = a post-#19 order with none selected — the same
-- never-computed-vs-zero distinction as tax_cents (20260713). The checkout
-- route de-duplicates and writes in canonical order (extra_revision,
-- rush_48h).
--
-- RLS: projects policies are row-level, so the new column rides them
-- unchanged — same precedent as 20260702_add_order_fields and
-- 20260713_add_tax_fields.
--
-- The 20260708 INSERT fence is deliberately unchanged: the checkout route
-- stamps this column at insert with the USER session (like amount_cents and
-- tax_cents). A forged value on a self-inserted unpaid row buys nothing —
-- the PaymentIntent is priced server-side, its metadata carries the paid
-- add-ons for the payment-status cross-check, and the freeze below makes
-- the column immutable once the row exists. Residual consistent with #43.

alter table public.projects
  add column add_ons text[]
    check (
      add_ons is null
      or add_ons <@ array['extra_revision', 'rush_48h']::text[]
    );

-- Freeze the persisted add-ons against client rewrites, exactly as 20260713
-- (wire_discount_redemption) widened the 20260702 trigger: the function body
-- is generic, so only the trigger's column list + when-clause change.
drop trigger if exists projects_enforce_studio_only_order_fields on public.projects;

create trigger projects_enforce_studio_only_order_fields
  before update of song_count, stem_count, subtotal_cents, amount_cents,
    currency, stripe_payment_intent_id, paid_at, discount_applied,
    terms_accepted_at, terms_version, tax_cents, buyer_country, buyer_province,
    applied_coupon_code, add_ons
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
    or old.add_ons is distinct from new.add_ons
  )
  execute function public.enforce_studio_only_order_fields();
