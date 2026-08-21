alter table public.profiles
  add column if not exists membership_card_url text;
