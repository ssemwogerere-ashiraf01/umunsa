-- 041: One row per seat. Replaces 040 (do not run 040; if you already did, this is still safe).
--
-- Over time the same seat was created under up to three names:
--   001 seed:  "Information Minister"
--   021/022:   "Information Secretary"
--   admin UI:  "Secretary for Information"
-- so the seat appeared several times in Vacant Positions and the election lists,
-- and stayed "vacant" while a leader sitting in it was stored under another name.
--
-- This keeps the "Secretary for ..." name (the one your leaders already hold) and, for every
-- other name of the same seat:
--   * moves its candidate applications and ballots to the kept seat
--   * renames leaders.position to the kept name
--   * deletes the duplicate seat
-- If the kept name doesn't exist yet, the first existing variant is renamed to it.
-- Finally, leaders still sitting on the retired generic "Faculty Representative /
-- Coordinator" or "Hall / Hostel Representative" seats are moved to the seat for their
-- own faculty / hostel. Safe to run more than once.
--
-- Do NOT re-run 021 or 022 afterwards: they re-insert the "... Secretary" names.

do $$
declare
  groups jsonb := '[
    {"keep":"Secretary for Information",          "from":["Information Minister","Information Secretary"]},
    {"keep":"Deputy Secretary for Information",   "from":["Deputy Information Minister","Deputy Information Secretary"]},
    {"keep":"Secretary for Ethics",               "from":["Ethics Minister","Ethics Secretary"]},
    {"keep":"Deputy Secretary for Ethics",        "from":["Deputy Ethics Minister","Deputy Ethics Secretary"]},
    {"keep":"Secretary for Games & Sports",       "from":["Games & Sports Minister","Games & Sports Secretary","Secretary for Games and Sports"]},
    {"keep":"Secretary for Projects",             "from":["Projects Minister","Projects Secretary"]},
    {"keep":"Secretary for Public Relations",     "from":["Minister of Public Relations","Public Relations Secretary"]},
    {"keep":"Deputy Secretary for Public Relations","from":["Deputy Minister of Public Relations","Deputy Public Relations Secretary"]},
    {"keep":"Secretary for Culture",              "from":["Minister of Culture","Culture Secretary"]},
    {"keep":"Deputy Secretary for Culture",       "from":["Deputy Minister of Culture","Deputy Culture Secretary"]},
    {"keep":"Secretary for Community Services",   "from":["Community Services Minister","Community Services Secretary"]}
  ]'::jsonb;
  grp     jsonb;
  canon   text;
  v       text;
  keep_id uuid;
  old_id  uuid;
begin
  for grp in select * from jsonb_array_elements(groups) loop
    canon := grp->>'keep';

    select id into keep_id from public.positions where name = canon;

    if keep_id is null then
      select id into keep_id
      from public.positions
      where name in (select jsonb_array_elements_text(grp->'from'))
      order by display_order
      limit 1;
      if keep_id is not null then
        update public.positions set name = canon where id = keep_id;
      end if;
    end if;

    for v in select jsonb_array_elements_text(grp->'from') loop
      old_id := null;
      if keep_id is not null then
        select id into old_id from public.positions where name = v and id <> keep_id;
      end if;

      if old_id is not null then
        -- same person applied to both seats in one election: keep the kept-seat application
        delete from public.candidates c
        using public.candidates k
        where c.position_id = old_id and k.position_id = keep_id
          and k.election_id = c.election_id and k.user_id = c.user_id;

        update public.candidates set position_id = keep_id where position_id = old_id;
        update public.votes      set position_id = keep_id where position_id = old_id;
        delete from public.positions where id = old_id;
      end if;

      update public.leaders set position = canon where position = v;
    end loop;
  end loop;
end $$;

-- Retired generic seats -> the leader's own faculty / hostel seat
update public.leaders l
set position = p.name
from public.profiles pr, public.positions p
where l.user_id = pr.id
  and l.position = 'Faculty Representative / Coordinator'
  and p.scope_type = 'faculty'
  and p.scope_value <> '__legacy_generic__'
  and lower(btrim(p.scope_value)) = lower(btrim(pr.faculty));

update public.leaders l
set position = p.name
from public.profiles pr, public.positions p
where l.user_id = pr.id
  and l.position = 'Hall / Hostel Representative'
  and p.scope_type = 'hostel'
  and p.scope_value <> '__legacy_generic__'
  and lower(btrim(p.scope_value)) = lower(btrim(pr.hostel));
