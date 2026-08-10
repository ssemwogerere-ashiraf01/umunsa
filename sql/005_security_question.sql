-- 005: Add security question support for password resets
-- Run AFTER previous migration files.

alter table public.profiles
  add column if not exists security_question text,
  add column if not exists security_answer_hash text;

comment on column public.profiles.security_question is 'Optional user-chosen security question for password recovery.';
comment on column public.profiles.security_answer_hash is 'SHA-256 hex hash of the security answer. Stored to verify recovery requests.';

create index if not exists idx_profiles_security_question on public.profiles((security_question is not null));
