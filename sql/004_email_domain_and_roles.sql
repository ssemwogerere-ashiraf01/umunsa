-- =========================================================================
-- 004. EMAIL DOMAIN ENFORCEMENT + SUPER ADMIN BOOTSTRAP
--
--   Domain constant (no leading @): umu.ac.ug
--
--   - Self-registration only for real addresses on umu.ac.ug or a
--     subdomain (e.g. name@umu.ac.ug, name@students.umu.ac.ug).
--   - Super Admin adds members via admin-create-user Edge Function with
--     app_metadata.added_by_super_admin = true → any email domain allowed.
--
-- Run AFTER 001_schema.sql, 002_rls_policies.sql, 003_storage.sql.
-- =========================================================================

create or replace function public.enforce_email_domain()
returns trigger as $$
declare
  added_by_admin boolean;
  email_domain text;
begin
  added_by_admin := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);

  if not added_by_admin then
    email_domain := lower(split_part(new.email, '@', 2));
    -- Must be exactly umu.ac.ug OR end with .umu.ac.ug (subdomain)
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
$$ language plpgsql security definer set search_path = public;

drop trigger if exists enforce_email_domain_trg on auth.users;
create trigger enforce_email_domain_trg
  after insert on auth.users
  for each row execute procedure public.enforce_email_domain();

-- -------------------------------------------------------------------------
-- SUPER ADMIN BOOTSTRAP (run once after you have registered)
-- -------------------------------------------------------------------------
-- update public.profiles
-- set role = 'super_admin',
--     membership_status = 'active',
--     onboarding_completed = true
-- where lower(email) = 'REPLACE_WITH_YOUR_EMAIL@umu.ac.ug';

create or replace function public.current_user_is_super_admin()
returns boolean
language sql security definer stable as $$
  select public.is_super_admin();
$$;

select count(*) missing_profiles
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.profiles (id, email, full_name, phone, added_by_super_admin, membership_status, onboarding_completed, created_at, updated_at)
select u.id, u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@',1)),
  nullif(coalesce(u.raw_user_meta_data->>'phone',''), ''),
  coalesce((u.raw_app_meta_data->>'added_by_super_admin')::boolean, false),
  case when coalesce((u.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
       then 'active'::membership_status else 'pending'::membership_status end,
  coalesce((u.raw_app_meta_data->>'added_by_super_admin')::boolean, false),
  now(), now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- triggers on profiles
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.profiles'::regclass;

-- triggers on auth.users
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'auth.users'::regclass;
