-- 036: Ensure incomplete profiles cannot skip onboarding
update public.profiles
set onboarding_completed = false
where onboarding_completed = true
  and (
    full_name is null or btrim(full_name) = ''
    or phone is null or btrim(phone) = ''
    or registration_number is null or btrim(registration_number) = ''
    or campus is null or btrim(campus) = ''
    or faculty is null or btrim(faculty) = ''
    or programme is null or btrim(programme) = ''
    or hostel is null or btrim(hostel) = ''
    or academic_year is null or btrim(academic_year) = ''
    or year_of_study is null
    or semester is null
    or avatar_url is null or btrim(avatar_url) = ''
  );
