-- Allow clients to update their own projects (e.g., transition status to 'processing')
create policy "Clients can update their own projects"
  on projects for update using (
    auth.uid() = owner_id
  );
