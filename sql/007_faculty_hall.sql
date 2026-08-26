-- 007: Faculty and hall/hostel on profiles (for Faculty Rep & Hall Rep elections)
-- Run in Supabase SQL Editor after previous migrations.

alter table public.profiles
  add column if not exists faculty text,
  add column if not exists hall_hostel text;

comment on column public.profiles.faculty is 'Faculty / school the member belongs to (used for Faculty Representative elections).';
comment on column public.profiles.hall_hostel is 'Hall or hostel of residence (used for Hall / Hostel Representative elections).';
