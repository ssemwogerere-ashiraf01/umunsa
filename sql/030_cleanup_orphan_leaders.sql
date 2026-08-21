-- 030: Remove incomplete / duplicate current leaders
-- Safe: only deletes rows with no name and no linked member, or exact duplicate positions.

-- 1) Orphans: no full_name and no user_id (show as "Unknown Member" / "Leader")
delete from public.leaders
where (full_name is null or btrim(full_name) = '')
  and user_id is null;

-- 2) For current term, keep one row per position (prefer row that has a name + photo)
delete from public.leaders a
using public.leaders b
where a.is_current = true
  and b.is_current = true
  and a.position = b.position
  and a.id > b.id
  and (
    -- prefer the one with a name
    (coalesce(btrim(b.full_name), '') <> '' and coalesce(btrim(a.full_name), '') = '')
    or (coalesce(b.photo_url, '') <> '' and coalesce(a.photo_url, '') = '' and coalesce(btrim(a.full_name), '') = coalesce(btrim(b.full_name), ''))
    or (coalesce(btrim(a.full_name), '') = coalesce(btrim(b.full_name), '') and a.id > b.id)
  );

-- 3) Stricter: if two current rows share the same position, keep lowest id that has a non-empty name
delete from public.leaders a
where a.is_current = true
  and exists (
    select 1 from public.leaders b
    where b.is_current = true
      and b.position = a.position
      and b.id < a.id
      and coalesce(btrim(b.full_name), '') <> ''
  );
