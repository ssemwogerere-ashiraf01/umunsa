-- 040: Remove the duplicate "Information Minister" position.
--
-- The seat exists twice: once under its old name ("Information Minister",
-- from 001_schema.sql) and once under its current name ("Information
-- Secretary", or "Secretary for Information" if it was added by hand).
-- This keeps the current-name seat and deletes the old one.
--
-- Anything that pointed at the old seat is moved to the kept seat first, so
-- nothing is orphaned and no foreign key fails:
--   * candidate applications  (candidates.position_id)
--   * ballots                 (votes.position_id)
--   * sitting / past leaders  (leaders.position is stored as text)
-- If only the old name exists, it is renamed instead of deleted.
-- Safe to run more than once.

do $$
declare
  old_id    uuid;
  keep_id   uuid;
  keep_name text;
begin
  select id into old_id
  from public.positions
  where name = 'Information Minister'
  limit 1;

  if old_id is null then
    raise notice '040: no "Information Minister" position found - nothing to do.';
    return;
  end if;

  select id, name into keep_id, keep_name
  from public.positions
  where name in ('Information Secretary', 'Secretary for Information')
    and id <> old_id
  order by (name = 'Information Secretary') desc
  limit 1;

  -- No replacement seat exists: rename the old one rather than lose the seat.
  if keep_id is null then
    update public.positions set name = 'Information Secretary' where id = old_id;
    update public.leaders set position = 'Information Secretary' where position = 'Information Minister';
    raise notice '040: no replacement seat existed - renamed "Information Minister" to "Information Secretary".';
    return;
  end if;

  -- Same person applied to both seats in the same election: keep the
  -- application on the kept seat, drop the duplicate on the old one
  -- (its ballots go with it via votes.candidate_id ON DELETE CASCADE, see 037).
  delete from public.candidates c
  using public.candidates k
  where c.position_id = old_id
    and k.position_id = keep_id
    and k.election_id = c.election_id
    and k.user_id = c.user_id;

  update public.candidates set position_id = keep_id where position_id = old_id;
  update public.votes      set position_id = keep_id where position_id = old_id;
  update public.leaders    set position    = keep_name where position = 'Information Minister';

  delete from public.positions where id = old_id;

  raise notice '040: removed "Information Minister"; kept "%".', keep_name;
end $$;
