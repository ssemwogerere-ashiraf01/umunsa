-- 010: Block candidacy applications while the user holds any current cabinet seat.
-- Run in Supabase SQL Editor after previous migrations.

create or replace function public.prevent_candidacy_if_current_leader()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  held text;
begin
  select string_agg(position, ', ' order by position)
  into held
  from public.leaders
  where user_id = new.user_id
    and is_current = true;

  if held is not null then
    raise exception
      'You currently hold a cabinet position (%). Current leaders cannot apply for other positions until the seat is vacated or the term ends.',
      held;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_candidacy_if_current_leader on public.candidates;
create trigger trg_prevent_candidacy_if_current_leader
  before insert on public.candidates
  for each row
  execute function public.prevent_candidacy_if_current_leader();

comment on function public.prevent_candidacy_if_current_leader() is
  'Rejects candidate applications from users who already appear in leaders with is_current = true.';
