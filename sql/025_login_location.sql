-- 025: Location logging on login attempts
--
-- Adds login_attempts.location, populated best-effort by the login-guard
-- Edge Function (server-side IP geolocation via GeoJS) alongside the
-- ip_address column that was already being captured. Read access is
-- already restricted to the super admin by the existing
-- "login_attempts_super_admin_read" policy from 002_rls_policies.sql —
-- nothing further to grant here.

alter table public.login_attempts
  add column if not exists location text;

comment on column public.login_attempts.location is 'Best-effort "City, Country" resolved server-side from ip_address at login time. Null if the lookup failed, timed out, or the IP was unknown/private.';
