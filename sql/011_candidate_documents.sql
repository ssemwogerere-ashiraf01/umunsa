-- 011: Candidate application documents + storage bucket

alter table public.candidates
  add column if not exists cv_url text;

alter table public.candidates
  add column if not exists leadership_certificate_url text;

alter table public.candidates
  add column if not exists application_letter_url text;

comment on column public.candidates.cv_url is 'Uploaded CV / resume URL';
comment on column public.candidates.leadership_certificate_url is 'Certificate of former leadership URL';
comment on column public.candidates.application_letter_url is 'Application letter URL';

-- Private-ish bucket: readable by active members and admins via signed/public URL;
-- use public bucket for simplicity so admin can open links without signed URLs.
insert into storage.buckets (id, name, public)
values ('election-docs', 'election-docs', true)
on conflict (id) do nothing;

drop policy if exists "election_docs_public_read" on storage.objects;
drop policy if exists "election_docs_insert_own" on storage.objects;
drop policy if exists "election_docs_update_own" on storage.objects;
drop policy if exists "election_docs_delete_own" on storage.objects;

create policy "election_docs_public_read" on storage.objects
  for select using (bucket_id = 'election-docs');

create policy "election_docs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'election-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "election_docs_update_own" on storage.objects
  for update using (
    bucket_id = 'election-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "election_docs_delete_own" on storage.objects
  for delete using (
    bucket_id = 'election-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Ensure members can update their own application docs before approval (optional)
drop policy if exists "candidates_update_own_pending" on public.candidates;
create policy "candidates_update_own_pending" on public.candidates
  for update
  using (user_id = auth.uid() and approved = false)
  with check (user_id = auth.uid());
