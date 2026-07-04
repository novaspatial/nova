-- T&C consent capture at checkout (S7 #23). The devplan required terms before
-- the priced checkout went live (2026-07-02); this records which version of the
-- terms a client agreed to, and when, on their order row (D1: order data lives
-- on the projects row).

-- --- 1. Consent columns. They ride the existing row-level insert/select/update
-- policies on projects unchanged (same precedent as 20260702_add_order_fields:
-- no column-level grants exist that would need widening). Nullable — rows
-- created before this migration have no recorded consent.
alter table public.projects
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- --- 2. Freeze the consent columns against client rewrites, exactly as the
-- money/order-integrity columns are frozen (20260702_harden_order_writes). The
-- client UPDATE policy (20260303) is row-level and column-agnostic, so without
-- this an owner could null out or forge their recorded consent after ordering.
-- Consent is captured at INSERT (untouched by this BEFORE UPDATE trigger);
-- service contexts (auth.uid() null) and studio profiles still pass. The
-- function body is generic, so only the trigger's column list + when-clause
-- change — recreate the trigger to add terms_accepted_at / terms_version.
drop trigger if exists projects_enforce_studio_only_order_fields on public.projects;

create trigger projects_enforce_studio_only_order_fields
  before update of song_count, stem_count, subtotal_cents, amount_cents,
    currency, stripe_payment_intent_id, paid_at, discount_applied,
    terms_accepted_at, terms_version
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
  )
  execute function public.enforce_studio_only_order_fields();
