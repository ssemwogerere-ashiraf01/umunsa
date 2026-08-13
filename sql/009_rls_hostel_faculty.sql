-- 009: RLS notes / hardening for profiles.hostel and profiles.faculty
-- Existing policies already cover ALL columns on profiles:
--   SELECT: own row OR is_admin()
--   UPDATE: own row (members) OR is_admin()
--   DELETE: super admin only
-- hostel and faculty are intentionally member-editable (like phone, bio).
-- protect_sensitive_profile_fields() does NOT block them (only role,
-- membership_status, approval, lockout, assigned_admin_*).

-- Ensure RLS is on (idempotent)
alter table public.profiles enable row level security;

-- No new policies required for hostel/faculty specifically.
-- Optional: allow members to clear/set hostel & faculty only on their own row
-- is already granted by "profiles_update_own".

-- Defense-in-depth: if you later expose a public member directory, do NOT
-- select hostel/phone for non-admins without an explicit policy. Current
-- select policy is already own-or-admin only.

comment on column public.profiles.hostel is
  'Student hall/hostel. Readable by owner and admins; writable by owner and admins under profiles_update_* policies.';
comment on column public.profiles.faculty is
  'Faculty/school. Readable by owner and admins; writable by owner and admins under profiles_update_* policies.';
