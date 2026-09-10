-- 011: Fix "Database error creating new user" when Super Admin adds a member
-- (any domain, including Gmail) via the admin-create-user Edge Function.
--
-- Root causes this migration addresses:
-- 1. enforce_email_domain rejects non-@umu.ac.ug unless app_metadata.added_by_super_admin = true
-- 2. handle_new_user must insert hostel/faculty/programme without failing
-- 3. protect_sensitive_fields blocks role updates when called with the service role
--    (auth.uid() is null) — Edge Functions need to set role = 'admin' after create
--
-- Run in Supabase SQL Editor after previous migrations.

-- ---------------------------------------------------------------------------
-- 1. Email domain: allow super-admin–created accounts on any domain
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
  added_by_admin := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);

  if not added_by_admin then
    email_domain := lower(split_part(new.email, '@', 2));
    if email_domain is distinct from 'umu.ac.ug'
       and email_domain not like '%.umu.ac.ug' then
      raise exception
        'Registration is restricted to umu.ac.ug email addresses (including subdomains). Ask a Super Admin to add this account if it should be an exception.';
    end if;
    if email_domain is null or email_domain = '' then
      raise exception 'A valid email address is required.';
    end if;
  end if;

  return new;
end;
$$;

-- Prefer BEFORE INSERT so a bad domain never creates a half-baked auth row
drop trigger if exists enforce_email_domain_trg on auth.users;
create trigger enforce_email_domain_trg
  before insert on auth.users
  for each row execute procedure public.enforce_email_domain();

-- ---------------------------------------------------------------------------
-- 2. handle_new_user: include hostel / faculty / programme; never fail hard
--    on optional columns; honour intended_role from app_metadata when present
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added boolean := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);
  v_role text := coalesce(nullif(new.raw_app_meta_data->>'intended_role', ''), 'member');
  v_status membership_status;
begin
  if v_role not in ('member', 'admin', 'super_admin') then
    v_role := 'member';
  end if;
  -- Only super-admin–created accounts may start as admin/super_admin
  if not v_added then
    v_role := 'member';
  end if;

  v_status := case when v_added then 'active'::membership_status else 'pending'::membership_status end;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    registration_number,
    hostel,
    faculty,
    programme,
    role,
    added_by_super_admin,
    membership_status,
    onboarding_completed
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'registration_number', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'hostel', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'faculty', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'programme', ''), ''),
    v_role::user_role,
    v_added,
    v_status,
    v_added
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    hostel = coalesce(excluded.hostel, profiles.hostel),
    faculty = coalesce(excluded.faculty, profiles.faculty),
    programme = coalesce(excluded.programme, profiles.programme),
    role = case when v_added then excluded.role else profiles.role end,
    membership_status = case when v_added then excluded.membership_status else profiles.membership_status end,
    added_by_super_admin = profiles.added_by_super_admin or excluded.added_by_super_admin,
    onboarding_completed = profiles.onboarding_completed or excluded.onboarding_completed,
    updated_at = now();

  return new;
exception
  when others then
    -- Re-raise with a clearer prefix so Auth surfaces a useful message
    raise exception 'Profile bootstrap failed: %', SQLERRM;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Allow service_role (Edge Functions) to change role / membership_status
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
  -- Service role / Edge Functions: allow
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

  -- Super admin may change role
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  -- Admin or super admin may change membership_status
  if new.membership_status is distinct from old.membership_status
     and not (public.is_super_admin() or public.is_admin()) then
    raise exception 'Only an admin or super admin can change membership status';
  end if;

  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists protect_sensitive_fields on public.profiles;
create trigger protect_sensitive_fields
  before update on public.profiles
  for each row execute procedure public.protect_sensitive_profile_fields();

-- Optional: ensure hostel / faculty columns exist (from 007 migrations)
alter table public.profiles add column if not exists hostel text;
alter table public.profiles add column if not exists faculty text;
alter table public.profiles add column if not exists programme text;

comment on function public.handle_new_user() is
  'Creates/updates profiles on auth signup. Super-admin–created users (app_metadata.added_by_super_admin) may use any email and start active with an intended role.';
