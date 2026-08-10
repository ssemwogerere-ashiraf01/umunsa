-- 006: Add student/staff registration number
-- Run AFTER previous migration files.

alter table public.profiles
  add column if not exists registration_number text;

comment on column public.profiles.registration_number is 'UMU student/staff registration number, e.g. 2026-B101-10000, provided on application and editable during onboarding.';

-- Pick up the value from auth signup metadata (set by apply.html /
-- registerWithEmail) when a profile row is first created.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, registration_number, added_by_super_admin, membership_status, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'registration_number', ''), ''),
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false),
    case when coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
         then 'active'::membership_status
         else 'pending'::membership_status end,
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
