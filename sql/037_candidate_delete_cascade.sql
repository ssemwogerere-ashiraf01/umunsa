-- 037: Allow admin to remove candidate applications that already have votes
-- 1) Admins may delete related votes
-- 2) votes.candidate_id cascades on candidate delete

drop policy if exists votes_admin_delete on public.votes;
create policy votes_admin_delete on public.votes
  for delete
  using (public.is_admin());

-- Recreate FK with ON DELETE CASCADE (constraint name may vary)
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'votes'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%candidate_id%candidates%';
  if con_name is not null then
    execute format('alter table public.votes drop constraint %I', con_name);
  end if;
end $$;

alter table public.votes
  add constraint votes_candidate_id_fkey
  foreign key (candidate_id) references public.candidates(id) on delete cascade;
