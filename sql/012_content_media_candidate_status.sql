-- 012: Content media/document fields + candidate application status

alter table public.candidates
  add column if not exists application_status text not null default 'pending';

update public.candidates
set application_status = case when approved then 'approved' else 'pending' end
where application_status is null or application_status = 'pending';

alter table public.news
  add column if not exists document_url text;

alter table public.news
  add column if not exists external_url text;

alter table public.activities
  add column if not exists document_url text;

alter table public.activities
  add column if not exists external_url text;

alter table public.projects
  add column if not exists image_url text;

alter table public.projects
  add column if not exists document_url text;

alter table public.projects
  add column if not exists external_url text;

alter table public.forum_topics
  add column if not exists image_url text;

alter table public.forum_topics
  add column if not exists document_url text;

alter table public.forum_topics
  add column if not exists external_url text;

insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;

drop policy if exists "content_media_public_read" on storage.objects;
drop policy if exists "content_media_admin_write" on storage.objects;
drop policy if exists "content_media_admin_update" on storage.objects;
drop policy if exists "content_media_admin_delete" on storage.objects;

create policy "content_media_public_read" on storage.objects
  for select using (bucket_id = 'content-media');

create policy "content_media_admin_write" on storage.objects
  for insert with check (bucket_id = 'content-media' and public.is_admin());

create policy "content_media_admin_update" on storage.objects
  for update using (bucket_id = 'content-media' and public.is_admin());

create policy "content_media_admin_delete" on storage.objects
  for delete using (bucket_id = 'content-media' and public.is_admin());

-- Active members may upload their own forum/content files
drop policy if exists "content_media_member_write" on storage.objects;
create policy "content_media_member_write" on storage.objects
  for insert with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );
