-- 034: tribe + clan on profiles; force incomplete members back to onboarding

alter table public.profiles add column if not exists tribe text;
alter table public.profiles add column if not exists clan text;

comment on column public.profiles.tribe is 'Member tribe (Uganda indigenous or Other)';
comment on column public.profiles.clan is 'Clan / lineage within tribe';

-- Members missing required profile fields must complete onboarding again
update public.profiles
set onboarding_completed = false
where membership_status = 'active'
  and (
    full_name is null or btrim(full_name) = ''
    or phone is null or btrim(phone) = ''
    or programme is null or btrim(programme) = ''
    or faculty is null or btrim(faculty) = ''
    or hostel is null or btrim(hostel) = ''
    or registration_number is null or btrim(registration_number) = ''
    or avatar_url is null or btrim(avatar_url) = ''
  );
