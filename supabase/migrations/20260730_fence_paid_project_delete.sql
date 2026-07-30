-- #48: the DELETE policy let an owner hard-delete any of their projects,
-- including paid and delivered ones — destroying the order/consent/tax
-- record that even the 90-day purge deliberately preserves, and opening a
-- charge-without-project race against the Stripe webhook.
--
-- RLS-first: the app gate is defense-in-depth, this is the floor. Same
-- fence shape as the rest of the family — service contexts (the purge
-- cron, webhook, any sessionless writer) and studio pass; a client
-- deleting a paid row raises 42501.
create or replace function public.enforce_unpaid_client_deletes()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return old;
  end if;
  if public.is_studio() then
    return old;
  end if;
  if old.paid_at is null then
    return old;
  end if;
  raise exception 'a paid project can only be deleted by studio or service contexts'
    using errcode = '42501';
end;
$$;

create trigger projects_enforce_unpaid_client_deletes
  before delete on public.projects
  for each row
  execute function public.enforce_unpaid_client_deletes();
