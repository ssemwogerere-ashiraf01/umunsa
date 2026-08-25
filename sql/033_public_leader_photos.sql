-- 033: Public RPC so leadership page can show profile photos without broad profiles RLS access

create or replace function public.get_leader_display_photos(
  p_ids uuid[] default null,
  p_names text[] default null
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
stable
as $fn$
  select p.id as user_id, p.full_name, p.avatar_url
  from public.profiles p
  where p.avatar_url is not null
    and btrim(p.avatar_url) <> ''
    and (
      (p_ids is not null and cardinality(p_ids) > 0 and p.id = any (p_ids))
      or (
        p_names is not null and cardinality(p_names) > 0
        and lower(btrim(p.full_name)) in (
          select lower(btrim(n)) from unnest(p_names) as n
          where n is not null and btrim(n) <> ''
        )
      )
    );
$fn$;

grant execute on function public.get_leader_display_photos(uuid[], text[]) to anon, authenticated;

-- Optional: public_leader_profile single-row helper (if missing)
create or replace function public.public_leader_profile(p_user_id uuid)
returns table (full_name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $fn$
  select p.full_name, p.avatar_url
  from public.profiles p
  where p.id = p_user_id
  limit 1;
$fn$;

grant execute on function public.public_leader_profile(uuid) to anon, authenticated;
