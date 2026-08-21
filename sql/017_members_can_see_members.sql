-- 017: Allow active members to see other active members (for Messages / directory)

-- Existing policy only allows own row or admin. Add peer visibility for active members.
drop policy if exists profiles_select_active_peers on public.profiles;

create policy profiles_select_active_peers
  on public.profiles
  for select
  using (
    public.is_active_member()
    and membership_status = 'active'
  );
