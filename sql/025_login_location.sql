alter table public.login_attempts
  add column if not exists location text;

comment on column public.login_attempts.location is
  'Best-effort City, Country from IP at login time.';
