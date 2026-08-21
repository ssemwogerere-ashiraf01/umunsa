-- 007: Membership ID card support
-- Run AFTER previous migration files.
--
-- Adds:
--   - profiles.student_id            (auto-computed, stored, from registration_number)
--   - profiles.membership_card_number (auto-assigned once a member is approved/'active')
--   - profiles.card_issued_at
--   - public.compute_student_id(text)          — the student ID formula, reusable
--   - public.get_member_card_info(text)         — public read-only lookup used by
--                                                  verify.html when a card's QR code
--                                                  is scanned
--
-- STUDENT ID FORMULA (per club rule):
--   last 2 digits of the registration year + "0050" + last 4 digits of the
--   registration number.
--   e.g. registration_number = '2024-B201-11819'  ->  student_id = '2400501819'
--                                24        0050        1819

create or replace function public.compute_student_id(p_registration_number text)
returns text
language sql
immutable
as $$
  select case
    when p_registration_number is null or length(p_registration_number) < 4 then null
    else substring(p_registration_number from 3 for 2) || '0050' || right(p_registration_number, 4)
  end;
$$;

alter table public.profiles
  add column if not exists student_id text generated always as (public.compute_student_id(registration_number)) stored,
  add column if not exists membership_card_number text unique,
  add column if not exists card_issued_at timestamptz;

comment on column public.profiles.student_id is 'Auto-computed from registration_number: YY + 0050 + last 4 digits of the registration number.';
comment on column public.profiles.membership_card_number is 'Sequential membership card number, e.g. NSA-000123. Assigned automatically the first time membership_status becomes ''active''.';
comment on column public.profiles.card_issued_at is 'Timestamp the membership card number was first assigned (used as the card "Issued" date).';

create sequence if not exists public.membership_card_seq start 1;

-- security definer so a plain admin (authenticated role, not the DB owner)
-- can still advance the shared sequence when they approve a member.
create or replace function public.assign_membership_card_number()
returns trigger as $$
begin
  if new.membership_status = 'active' and new.membership_card_number is null then
    new.membership_card_number := 'NSA-' || lpad(nextval('public.membership_card_seq')::text, 6, '0');
    new.card_issued_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_assign_card_number on public.profiles;
create trigger profiles_assign_card_number
  before insert or update on public.profiles
  for each row execute procedure public.assign_membership_card_number();

-- -------------------------------------------------------------------------
-- Public, read-only lookup for the QR code on the back of the card.
-- Scanning the card opens verify.html?card=NSA-000123, which calls this
-- function. Intentionally exposes only non-sensitive bio fields — never
-- email, phone, or auth data — and works for anyone (no login required),
-- since that's the point of a scannable ID card.
-- -------------------------------------------------------------------------
create or replace function public.get_member_card_info(p_card_number text)
returns table (
  full_name             text,
  programme             text,
  year_of_study         int,
  membership_status     text,
  avatar_url            text,
  student_id            text,
  registration_number   text,
  membership_card_number text,
  card_issued_at        timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select full_name, programme, year_of_study, membership_status::text, avatar_url,
         student_id, registration_number, membership_card_number, card_issued_at
  from public.profiles
  where membership_card_number = p_card_number;
$$;

grant execute on function public.get_member_card_info(text) to anon, authenticated;

create index if not exists idx_profiles_membership_card_number on public.profiles(membership_card_number);