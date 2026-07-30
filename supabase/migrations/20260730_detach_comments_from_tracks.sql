-- #58: purging a delivered project's mixes cascade-deleted the whole review
-- conversation (and its attachment rows) while the attachment objects were
-- never swept — the exact opposite of the documented retention rule, which
-- keeps the conversation and its attachments and only removes audio.
--
-- The ruling: the conversation outlives its Mix. The project row is kept
-- forever as the order/consent/tax record, and the discussion that produced
-- the delivered mix belongs with it. So track_id becomes nullable and its
-- FK detaches instead of cascading; the same applies when a studio deletes
-- a mix row outside the purge. A detached comment keeps its body, author,
-- timestamps, and attachments — the attachment objects it points at are the
-- ones that used to be orphaned.
alter table public.project_comments
  alter column track_id drop not null;

alter table public.project_comments
  drop constraint project_comments_track_id_fkey;

alter table public.project_comments
  add constraint project_comments_track_id_fkey
  foreign key (track_id) references public.project_files(id) on delete set null;
