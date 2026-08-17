-- 015: Safe check if email is already registered (works before login)

create or replace function public.email_already_registered(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as '
declare
  cleaned text;
begin
  cleaned := lower(trim(both from coalesce(p_email, '''')));
  if cleaned = '''' then
    return false;
  end if;

  if exists (
    select 1 from public.profiles
    where lower(trim(both from email)) = cleaned
  ) then
    return true;
  end if;

  if exists (
    select 1 from auth.users
    where lower(trim(both from email)) = cleaned
  ) then
    return true;
  end if;

  return false;
end;
';

grant execute on function public.email_already_registered(text) to anon, authenticated;
