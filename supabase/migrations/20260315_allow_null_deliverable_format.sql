-- Allow deliverables to be uploaded without a format.
-- Format is assigned at approval time via the "Mark Approved" action.
alter table deliverables
  alter column format drop not null,
  alter column format drop default;
