-- 020: Fix infinite recursion in chat_group_members RLS

create or replace function public.is_chat_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as '
  select exists (
    select 1 from public.chat_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
';

grant execute on function public.is_chat_group_member(uuid) to authenticated;

-- Replace recursive policies
drop policy if exists cgm_select on public.chat_group_members;
create policy cgm_select on public.chat_group_members
  for select using (
    user_id = auth.uid()
    or public.is_chat_group_member(group_id)
    or public.is_admin()
  );

drop policy if exists cg_select on public.chat_groups;
create policy cg_select on public.chat_groups
  for select using (
    public.is_chat_group_member(id)
    or public.is_admin()
  );

drop policy if exists gm_select on public.group_messages;
create policy gm_select on public.group_messages
  for select using (
    public.is_chat_group_member(group_id)
  );

drop policy if exists gm_insert on public.group_messages;
create policy gm_insert on public.group_messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_active_member()
    and public.is_chat_group_member(group_id)
  );
