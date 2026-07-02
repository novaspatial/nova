-- Per-song order fields for the priced checkout (S1 #16). D1: order data
-- stays on the projects row — one order equals one project.
--
-- RLS: projects policies are row-level (owner/studio), so the new columns
-- ride the existing insert/select/update policies unchanged. Verified: no
-- column-level grants exist on projects that would need widening.
--
-- song_count drives the per-song quote (computeOrderPrice); stem_count is
-- captured at checkout from the files the client actually selected for
-- upload; subtotal_cents stores the quoted mix subtotal (before tax — tax
-- is owned by D2/#24); reference_tracks holds the client's reference-track
-- notes from the order form.

alter table public.projects
  add column song_count integer
    check (song_count is null or song_count >= 1),
  add column stem_count integer
    check (stem_count is null or stem_count >= 0),
  add column subtotal_cents integer
    check (subtotal_cents is null or subtotal_cents >= 0),
  add column reference_tracks text;
