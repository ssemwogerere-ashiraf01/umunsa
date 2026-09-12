-- 013: Ensure auto-approve RPC exists and works for Google + email sign-up.
-- Safe to re-run.

create or replace function public.is_auto_approve_enabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select (value #>> '{}')::boolean
      from public.club_settings
      where key = 'auto_approve_members'
      limit 1
    ),
    (
      select (value->>'enabled')::boolean
      from public.club_settings
      where key = 'auto_approve_members'
      limit 1
    ),
    false
  );
$$;

create or replace function public.maybe_auto_approve_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  if not public.is_auto_approve_enabled() then
    return;
  end if;
  update public.profiles
  set membership_status = 'active',
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  where id = p_user_id
    and membership_status = 'pending';
end;
$$;

grant execute on function public.is_auto_approve_enabled() to anon, authenticated;
grant execute on function public.maybe_auto_approve_member(uuid) to anon, authenticated;

-- Optional: seed the setting if missing (default OFF — enable from Super Admin)
insert into public.club_settings (key, value)
values ('auto_approve_members', 'false'::jsonb)
on conflict (key) do nothing;
