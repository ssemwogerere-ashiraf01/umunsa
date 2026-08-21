-- 029: Leadership term window + clean duplicate position titles
-- Term: 24 Aug → 23 Aug next year

-- Soft archive current leaders whose term_end has passed
update public.leaders
set is_current = false
where is_current = true
  and term_end is not null
  and term_end < current_date;

-- Default term dates for current leaders missing dates (2025/26 cycle)
update public.leaders
set
  term_label = coalesce(nullif(btrim(term_label), ''), '2025/26'),
  term_start = coalesce(term_start, '2025-08-24'),
  term_end = coalesce(term_end, '2026-08-23')
where is_current = true;

-- Remove exact duplicate positions (keep lowest id per name)
delete from public.positions p
using public.positions p2
where p.name = p2.name
  and p.id > p2.id;
