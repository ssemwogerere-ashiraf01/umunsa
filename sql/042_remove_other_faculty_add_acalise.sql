-- 042: Remove invalid "Other" faculty + Faculty Rep seat; add Acalise hostel Hall Rep.
--
-- "Other" is not a real UMU faculty. Campuses may still use Other; hostels keep
-- Other (specify) on forms. Leadership seats must match real faculties/hostels.
--
-- Also syncs Hall/Hostel Representative for Acalise hostel (was missing from
-- the canonical list in 009 / site-config).

-- ---------------------------------------------------------------------------
-- 1. Remove "Other" faculty and any programmes under it
-- ---------------------------------------------------------------------------
delete from public.programmes
where faculty_id in (select id from public.faculties where name = 'Other');

delete from public.faculties
where name = 'Other';

-- ---------------------------------------------------------------------------
-- 2. Retire Faculty Representative seats for "Other" (and any other faculty
--    seat whose scope_value no longer exists in public.faculties)
-- ---------------------------------------------------------------------------
update public.positions p
set
  scope_type = 'faculty',
  scope_value = '__legacy_generic__',
  name = case
    when p.name ilike '%legacy%' then p.name
    else p.name || ' (legacy — Other is not a faculty)'
  end
where p.category = 'Faculty Rep'
  and coalesce(p.scope_value, '') <> ''
  and p.scope_value <> '__legacy_generic__'
  and p.name not ilike '%legacy%'
  and not exists (select 1 from public.faculties f where f.name = p.scope_value);

-- Explicit catch for common title variants
update public.positions
set
  scope_type = 'faculty',
  scope_value = '__legacy_generic__',
  name = name || ' (legacy — Other is not a faculty)'
where category = 'Faculty Rep'
  and name not ilike '%legacy%'
  and (
    scope_value = 'Other'
    or name ilike '%Faculty Representative%Other%'
  );

-- ---------------------------------------------------------------------------
-- 3. Ensure Acalise hostel Hall / Hostel Representative seat exists
-- ---------------------------------------------------------------------------
insert into public.positions (
  name, name_luganda, category, requires_fee, application_fee,
  display_order, scope_type, scope_value
)
values (
  'Hall / Hostel Representative — Acalise hostel',
  null,
  'Hall Rep',
  true,
  10000,
  212,
  'hostel',
  'Acalise hostel'
)
on conflict (name) do update set
  category = 'Hall Rep',
  scope_type = 'hostel',
  scope_value = 'Acalise hostel',
  application_fee = excluded.application_fee;

-- If the seat was never created under this exact name, insert when missing by scope
insert into public.positions (
  name, name_luganda, category, requires_fee, application_fee,
  display_order, scope_type, scope_value
)
select
  'Hall / Hostel Representative — Acalise hostel',
  null, 'Hall Rep', true, 10000, 212, 'hostel', 'Acalise hostel'
where not exists (
  select 1 from public.positions
  where scope_type = 'hostel' and scope_value = 'Acalise hostel'
)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Re-sync Faculty Rep seats from live faculties (no Other anymore)
-- ---------------------------------------------------------------------------
insert into public.positions (
  name, name_luganda, category, requires_fee, application_fee,
  display_order, scope_type, scope_value
)
select
  'Faculty Representative — ' || f.name,
  null, 'Faculty Rep', true, 10000, 100 + f.display_order, 'faculty', f.name
from public.faculties f
on conflict (name) do update set
  category = 'Faculty Rep',
  scope_type = 'faculty',
  scope_value = excluded.scope_value;
