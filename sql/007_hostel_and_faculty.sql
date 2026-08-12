-- 007: Add hostel and faculty to profiles; populate from auth signup metadata

-- Add columns to profiles
alter table public.profiles
  add column if not exists hostel text;

alter table public.profiles
  add column if not exists faculty text;

comment on column public.profiles.hostel is 'Student hall/hostel (e.g. Carabine) captured at signup';
comment on column public.profiles.faculty is 'Faculty / school captured at signup';

-- Update handle_new_user trigger function so new profiles include hostel and faculty
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, registration_number, hostel, faculty, added_by_super_admin, membership_status, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'registration_number', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'hostel',''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'faculty',''), ''),
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false),
    case when coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
         then 'active'::membership_status
         else 'pending'::membership_status end,
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
