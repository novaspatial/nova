-- Referral attribution is removed from the discount module (form, API, and
-- list no longer read or write it). The lookup_discount_code RPC never
-- returned this column, so no grants or policies change.
alter table public.discount_codes
  drop column if exists referral_attribution;
