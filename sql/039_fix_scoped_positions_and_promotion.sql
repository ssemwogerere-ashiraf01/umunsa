-- 039: Corrective fixes for three issues found in inspection.
--
-- (a) 021_seed_positions.sql and 022_rename_positions_secretaries.sql both
--     upsert a generic 'Faculty Representative / Coordinator' and
--     'Hall / Hostel Representative' row. Both files are numbered to run
--     AFTER 009_scoped_faculty_hostel_positions.sql (which already retired
--     those two names), so their ON CONFLICT(name) never matches the
--     renamed "(legacy...)" row — they insert a brand new, unscoped seat
--     that is visible/applyable to every member regardless of faculty or
--     hostel. This retires it again, however it got created.
--
-- (b) 009_scoped_faculty_hostel_positions.sql runs BEFORE
--     027_academic_structure.sql creates public.faculties, so its
--     "has_faculties" check was false and it fell back to a hardcoded,
--     incomplete 8-entry list with at least one name that doesn't match
--     the real faculty names (missing "the" in "Built Environment").
--     This re-syncs Faculty Rep seats from the real public.faculties table
--     and retires any seat whose scope_value doesn't match a real faculty.
--
-- (c) promote_election_winners() never deactivated the outgoing holder of
--     a seat before installing the new winner, which is the actual root
--     cause of "occupied position doesn't deactivate" and the reason
--     029/030 exist as manual, one-time cleanups. Fixed at the source so
--     it never needs to be cleaned up by hand again.

-- ---------------------------------------------------------------------------
-- (a) Retire the generic seats again, regardless of how they reappeared.
-- ---------------------------------------------------------------------------
update public.positions
set scope_type = 'faculty', scope_value = '__legacy_generic__',
    name = 'Faculty Representative / Coordinator (legacy — use faculty-specific seats)'
where name = 'Faculty Representative / Coordinator';

update public.positions
set scope_type = 'hostel', scope_value = '__legacy_generic__',
    name = 'Hall / Hostel Representative (legacy — use hostel-specific seats)'
where name = 'Hall / Hostel Representative';

-- ---------------------------------------------------------------------------
-- (b) Re-sync Faculty Rep seats from the authoritative public.faculties
--     table, which didn't exist yet the first time this ran.
-- ---------------------------------------------------------------------------
insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order, scope_type, scope_value)
select
  'Faculty Representative — ' || f.name,
  null, 'Faculty Rep', true, 10000, 100 + f.display_order, 'faculty', f.name
from public.faculties f
on conflict (name) do update set
  category = 'Faculty Rep',
  scope_type = 'faculty',
  scope_value = excluded.scope_value;

-- Retire any faculty-rep seat left over from the old hardcoded fallback list
-- whose scope_value no longer matches a real faculty name exactly (e.g. the
-- old "Faculty of Built Environment" vs. the real "Faculty of the Built
-- Environment") — these were invisible dead ends for their own members, so
-- take them out of circulation in favour of the freshly-synced seat above.
update public.positions p
set scope_type = 'faculty', scope_value = '__legacy_generic__',
    name = p.name || ' (legacy — superseded by exact-match seat)'
where p.category = 'Faculty Rep'
  and coalesce(p.scope_value, '') <> ''
  and p.scope_value <> '__legacy_generic__'
  and p.name not ilike '%legacy%'
  and not exists (select 1 from public.faculties f where f.name = p.scope_value);

-- ---------------------------------------------------------------------------
-- (c) Fix promote_election_winners so the outgoing holder is deactivated
--     before the new winner is installed — one current leader per seat,
--     always, with no manual cleanup required after an election closes.
-- ---------------------------------------------------------------------------
-- Drop first: Postgres refuses CREATE OR REPLACE if the existing function's
-- signature (return type / arg mode) differs at all from this one.
drop function if exists public.promote_election_winners(uuid);

create or replace function public.promote_election_winners(p_election_id uuid)
returns void
language plpgsql security definer as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can close an election and promote winners.';
  end if;

  -- Deactivate whoever currently holds any seat being contested in this
  -- election, before installing the winners, so no seat is ever left with
  -- two "current" leaders at once.
  update public.leaders l
  set is_current = false, term_end = coalesce(term_end, current_date)
  where l.is_current = true
    and l.position in (
      select distinct p.name
      from public.candidates c
      join public.positions p on p.id = c.position_id
      where c.election_id = p_election_id and c.approved = true
    );

  insert into public.leaders (user_id, position, is_current, display_order, term_start)
  select winner.user_id, winner.position_name, true, 0, current_date
  from (
    select distinct on (c.position_id)
      c.user_id, p.name as position_name, count(v.id) as vote_count
    from public.candidates c
    join public.positions p on p.id = c.position_id
    left join public.votes v on v.candidate_id = c.id and v.election_id = p_election_id
    where c.election_id = p_election_id and c.approved = true
    group by c.id, c.position_id, c.user_id, p.name
    order by c.position_id, count(v.id) desc
  ) as winner;

  update public.elections set status = 'closed' where id = p_election_id;
end;
$$;

-- Defensive data fix: sync any existing current leader's stored position
-- text to today's position names, in case a leader row was created back
-- when a position still had its pre-022-rename name (e.g. "Secretary"
-- instead of "General Secretary") — this is what would make an occupied
-- seat's Apply button wrongly reactivate, since occupancy is matched by
-- this exact text.
update public.leaders l
set position = mapping.new_name
from (values
  ('Secretary', 'General Secretary'),
  ('Deputy Secretary', 'Deputy General Secretary'),
  ('Information Minister', 'Information Secretary'),
  ('Deputy Information Minister', 'Deputy Information Secretary'),
  ('Ethics Minister', 'Ethics Secretary'),
  ('Deputy Ethics Minister', 'Deputy Ethics Secretary'),
  ('Games & Sports Minister', 'Games & Sports Secretary'),
  ('Projects Minister', 'Projects Secretary'),
  ('Minister of Public Relations', 'Public Relations Secretary'),
  ('Deputy Minister of Public Relations', 'Deputy Public Relations Secretary'),
  ('Minister of Culture', 'Culture Secretary'),
  ('Deputy Minister of Culture', 'Deputy Culture Secretary'),
  ('Community Services Minister', 'Community Services Secretary')
) as mapping(old_name, new_name)
where l.position = mapping.old_name;
