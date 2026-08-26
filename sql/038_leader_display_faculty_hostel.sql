-- 038: Include faculty & hostel on public leader display RPC
-- So Faculty / Hall representatives show the unit they represent on leadership pages.

create or replace function public.get_leader_display_photos(
  p_ids uuid[] default null,
  p_names text[] default null
)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  faculty text,
  hostel text
)
language sql
security definer
set search_path = public
stable
as $fn$
  select p.id as user_id, p.full_name, p.avatar_url, p.faculty, p.hostel
  from public.profiles p
  where (
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
