-- 028: Force members with incomplete profiles back to onboarding
-- Safe to run multiple times. Does not change membership_status.

update public.profiles
set onboarding_completed = false
where
  onboarding_completed = true
  and (
    full_name is null or btrim(full_name) = ''
    or phone is null or btrim(phone) = ''
    or registration_number is null or btrim(registration_number) = ''
    or campus is null or btrim(campus) = ''
    or faculty is null or btrim(faculty) = ''
    or programme is null or btrim(programme) = ''
    or hostel is null or btrim(hostel) = ''
    or academic_year is null or btrim(academic_year) = ''
    or year_of_study is null or year_of_study < 1
    or semester is null or semester not in (1, 2)
    or avatar_url is null or btrim(avatar_url) = ''
  );
