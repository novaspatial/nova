-- Allow studio users to delete deliverables.
create policy "Studio deletes deliverables"
  on public.deliverables for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'studio')
  );
