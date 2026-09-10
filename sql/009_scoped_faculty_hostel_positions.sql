-- 009: One Faculty Rep position per faculty, one Hall/Hostel Rep per hostel.
-- Also adds optional scope columns so elections UI can match user faculty/hostel
-- to the exact seat without relying only on profile comparison of generic titles.
--
-- Run in Supabase SQL Editor after previous migrations.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT patterns where possible).

-- ---------------------------------------------------------------------------
-- 1. Scope columns on positions
-- ---------------------------------------------------------------------------
alter table public.positions
  add column if not exists scope_type text
    check (scope_type is null or scope_type in ('faculty', 'hostel', 'global'));

alter table public.positions
  add column if not exists scope_value text;

comment on column public.positions.scope_type is
  'faculty | hostel | global (null treated as global for executive seats)';
comment on column public.positions.scope_value is
  'Exact faculty name or hostel name this seat represents; null for global seats';

-- Existing executive / cultural seats → global
update public.positions
set scope_type = 'global', scope_value = null
where scope_type is null
  and coalesce(category, '') not in ('Faculty Rep', 'Hall Rep')
  and name not ilike '%faculty%'
  and name not ilike '%hostel%'
  and name not ilike '%hall /%';

-- ---------------------------------------------------------------------------
-- 2. Canonical hostel list (matches assets/js/site-config.js HOSTEL_OPTIONS)
-- ---------------------------------------------------------------------------
-- Faculty list is taken from public.faculties if present; otherwise a minimal
-- fallback set is used so the migration still works on a fresh project.

do $$
declare
  fac record;
  hos text;
  hostels text[] := array[
    'Katonga hostel',
    'Bbosa hostel',
    'Kavuma hostel',
    'Lwanga hostel',
    'Byaben hostel',
    'Kololo hostel',
    'Ivis hostel',
    'Canan hostel',
    'Fountain hostel',
    'Angels hostel',
    'Wamala hostel',
    'Mugagga hostel',
    'Micheal hall',
    'Onyango hall',
    'Campbell hall',
    'Mukasa hall',
    'Martyrs hall',
    'Haflet hall',
    'Carabine hall'
  ];
  ord int := 100;
  has_faculties boolean;
begin
  -- Detect faculties table
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'faculties'
  ) into has_faculties;

  -- ---- Faculty Representative seats (one per faculty) ----
  if has_faculties then
    for fac in
      select name from public.faculties where coalesce(name, '') <> '' order by display_order nulls last, name
    loop
      insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order, scope_type, scope_value)
      values (
        'Faculty Representative — ' || fac.name,
        null,
        'Faculty Rep',
        true,
        10000,
        ord,
        'faculty',
        fac.name
      )
      on conflict (name) do update
        set category = excluded.category,
            scope_type = 'faculty',
            scope_value = excluded.scope_value,
            application_fee = excluded.application_fee;
      ord := ord + 1;
    end loop;
  else
    -- Fallback labels if faculties catalog not seeded yet
    foreach hos in array array[
      'Faculty of Science',
      'Faculty of Business Administration and Management',
      'Faculty of Education',
      'Faculty of Agriculture',
      'Faculty of Built Environment',
      'School of Arts and Social Sciences',
      'School of Medicine',
      'Institute of Ethics'
    ]
    loop
      insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order, scope_type, scope_value)
      values (
        'Faculty Representative — ' || hos,
        null,
        'Faculty Rep',
        true,
        10000,
        ord,
        'faculty',
        hos
      )
      on conflict (name) do update
        set category = excluded.category,
            scope_type = 'faculty',
            scope_value = excluded.scope_value;
      ord := ord + 1;
    end loop;
  end if;

  -- ---- Hall / Hostel Representative seats (one per hostel) ----
  ord := 200;
  foreach hos in array hostels
  loop
    insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order, scope_type, scope_value)
    values (
      'Hall / Hostel Representative — ' || hos,
      null,
      'Hall Rep',
      true,
      10000,
      ord,
      'hostel',
      hos
    )
    on conflict (name) do update
      set category = excluded.category,
          scope_type = 'hostel',
          scope_value = excluded.scope_value,
          application_fee = excluded.application_fee;
    ord := ord + 1;
  end loop;

  -- Retire generic single seats so they no longer appear as open Apply targets
  -- (keep row for historical candidates that may reference the id)
  update public.positions
  set scope_type = coalesce(scope_type, 'faculty'),
      scope_value = coalesce(scope_value, '__legacy_generic__'),
      name = case
        when name = 'Faculty Representative / Coordinator' then 'Faculty Representative / Coordinator (legacy — use faculty-specific seats)'
        when name = 'Hall / Hostel Representative' then 'Hall / Hostel Representative (legacy — use hostel-specific seats)'
        else name
      end
  where name in (
    'Faculty Representative / Coordinator',
    'Hall / Hostel Representative'
  );
end $$;

-- Helpful index for vacancy / eligibility lookups
create index if not exists idx_positions_scope
  on public.positions (scope_type, scope_value);

comment on table public.positions is
  'Electable offices. Faculty/Hall seats are one row per faculty or hostel (scope_type + scope_value).';
