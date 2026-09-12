-- 012: Member categories (student / graduate / lecturer / patron / staff)
--      + harden auth triggers so Super Admin can create any-domain users.
--
-- Run in Supabase SQL Editor AFTER 011 (or on its own; it re-applies the
-- critical create-user fixes in a safer form).
--
-- Why create-user still fails for many projects:
--   Auth returns "Database error creating new user" whenever ANY trigger on
--   auth.users raises. handle_new_user must NEVER raise — profile can be
--   fixed by the Edge Function with the service role afterward.
--   enforce_email_domain must accept added_by_super_admin from app_metadata
--   OR user_metadata (Auth Admin API sometimes surfaces it differently).

-- ---------------------------------------------------------------------------
-- 1. Member category + non-student profile fields
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.member_category as enum (
    'student',
    'graduate',
    'lecturer',
    'patron',
    'staff'
  );
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists member_category public.member_category not null default 'student';

alter table public.profiles
  add column if not exists designation text;          -- e.g. Senior Lecturer, Patron, Dean

alter table public.profiles
  add column if not exists department text;           -- academic dept / unit (non-students)

alter table public.profiles
  add column if not exists graduation_year int;       -- for alumni / graduates

alter table public.profiles
  add column if not exists organization text;         -- external org for patrons

alter table public.profiles
  add column if not exists is_alum boolean not null default false;

comment on column public.profiles.member_category is
  'student | graduate | lecturer | patron | staff — drives which profile/card fields apply';
comment on column public.profiles.designation is
  'Job title or honorary title (lecturer, patron, staff)';
comment on column public.profiles.department is
  'Department or unit for lecturers/staff (not the same as student faculty)';
comment on column public.profiles.graduation_year is
  'Year of graduation for alumni';
comment on column public.profiles.organization is
  'External organization for patrons / affiliates';

create index if not exists idx_profiles_member_category
  on public.profiles (member_category);

-- ---------------------------------------------------------------------------
-- 2. Email domain: allow super-admin path (app OR user metadata)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  added_by_admin boolean;
  email_domain text;
begin
  added_by_admin :=
       coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
    or coalesce((new.raw_user_meta_data->>'added_by_super_admin')::boolean, false);

  if not added_by_admin then
    email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));
    if email_domain is distinct from 'umu.ac.ug'
       and email_domain not like '%.umu.ac.ug' then
      raise exception
        'Registration is restricted to umu.ac.ug email addresses (including subdomains). Ask a Super Admin to add this account if it should be an exception.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_email_domain_trg on auth.users;
create trigger enforce_email_domain_trg
  before insert on auth.users
  for each row execute procedure public.enforce_email_domain();

-- ---------------------------------------------------------------------------
-- 3. handle_new_user: NEVER fail the Auth insert
--    Minimal insert first; optional columns best-effort.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added boolean :=
       coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
    or coalesce((new.raw_user_meta_data->>'added_by_super_admin')::boolean, false);
  v_role text := coalesce(
    nullif(new.raw_app_meta_data->>'intended_role', ''),
    nullif(new.raw_user_meta_data->>'intended_role', ''),
    'member'
  );
  v_category text := coalesce(
    nullif(new.raw_user_meta_data->>'member_category', ''),
    nullif(new.raw_app_meta_data->>'member_category', ''),
    'student'
  );
  v_status membership_status;
begin
  if v_role not in ('member', 'admin', 'super_admin') then
    v_role := 'member';
  end if;
  if not v_added then
    v_role := 'member';
  end if;
  if v_category not in ('student', 'graduate', 'lecturer', 'patron', 'staff') then
    v_category := 'student';
  end if;

  v_status := case when v_added then 'active'::membership_status else 'pending'::membership_status end;

  begin
    insert into public.profiles (
      id, email, full_name, phone,
      role, membership_status, onboarding_completed, added_by_super_admin,
      member_category
    ) values (
      new.id,
      new.email,
      coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
      nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
      v_role::user_role,
      v_status,
      v_added,
      v_added,
      v_category::public.member_category
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
      phone = coalesce(excluded.phone, profiles.phone),
      role = case when v_added then excluded.role else profiles.role end,
      membership_status = case when v_added then excluded.membership_status else profiles.membership_status end,
      added_by_super_admin = profiles.added_by_super_admin or excluded.added_by_super_admin,
      member_category = case when v_added then excluded.member_category else profiles.member_category end,
      onboarding_completed = profiles.onboarding_completed or excluded.onboarding_completed,
      updated_at = now();
  exception when others then
    -- Do not block Auth user creation. Edge Function will upsert the profile.
    raise warning 'handle_new_user profile insert failed for %: %', new.id, SQLERRM;
  end;

  -- Best-effort optional fields (ignore if columns missing in older DBs)
  begin
    update public.profiles set
      hostel = coalesce(nullif(new.raw_user_meta_data->>'hostel', ''), hostel),
      faculty = coalesce(nullif(new.raw_user_meta_data->>'faculty', ''), faculty),
      programme = coalesce(nullif(new.raw_user_meta_data->>'programme', ''), programme),
      registration_number = coalesce(nullif(new.raw_user_meta_data->>'registration_number', ''), registration_number),
      designation = coalesce(nullif(new.raw_user_meta_data->>'designation', ''), designation),
      department = coalesce(nullif(new.raw_user_meta_data->>'department', ''), department),
      organization = coalesce(nullif(new.raw_user_meta_data->>'organization', ''), organization),
      is_alum = case
        when v_category in ('graduate') then true
        else is_alum
      end,
      graduation_year = case
        when nullif(new.raw_user_meta_data->>'graduation_year', '') is not null
        then (new.raw_user_meta_data->>'graduation_year')::int
        else graduation_year
      end
    where id = new.id;
  exception when others then
    raise warning 'handle_new_user optional fields failed for %: %', new.id, SQLERRM;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Service role may update sensitive profile fields
-- ---------------------------------------------------------------------------
create or replace function public.protect_sensitive_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  begin
    jwt_role := coalesce(
      current_setting('request.jwt.claim.role', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
    );
  exception when others then
    jwt_role := null;
  end;

  if jwt_role = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  if new.membership_status is distinct from old.membership_status
     and not (public.is_super_admin() or public.is_admin()) then
    raise exception 'Only an admin or super admin can change membership status';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_sensitive_fields on public.profiles;
create trigger protect_sensitive_fields
  before update on public.profiles
  for each row execute procedure public.protect_sensitive_profile_fields();

-- Ensure base optional columns exist (older projects)
alter table public.profiles add column if not exists hostel text;
alter table public.profiles add column if not exists faculty text;
alter table public.profiles add column if not exists programme text;
alter table public.profiles add column if not exists registration_number text;
