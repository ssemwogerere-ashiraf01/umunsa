-- 008: Ensure admins can update and delete candidate applications (terminate)
-- Run in Supabase SQL Editor if Terminate/Approve fails with a policy error.

drop policy if exists "candidates_admin_write" on public.candidates;
create policy "candidates_admin_write" on public.candidates
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "candidates_admin_delete" on public.candidates;
create policy "candidates_admin_delete" on public.candidates
  for delete
  using (public.is_admin());
