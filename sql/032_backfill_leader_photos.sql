-- 032: Copy profile avatars onto leaders.photo_url for public display
-- (public pages may not be able to read profiles under RLS)

-- 1) Match by user_id
update public.leaders l
set photo_url = p.avatar_url
from public.profiles p
where l.photo_url is null
  and l.user_id is not null
  and p.id = l.user_id
  and p.avatar_url is not null
  and btrim(p.avatar_url) <> '';

-- 2) Match by exact full name (case-insensitive)
update public.leaders l
set photo_url = p.avatar_url
from public.profiles p
where l.photo_url is null
  and p.avatar_url is not null
  and btrim(p.avatar_url) <> ''
  and lower(btrim(l.full_name)) = lower(btrim(p.full_name));
