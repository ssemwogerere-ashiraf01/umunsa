-- 019: Atomic group create (avoids RLS race when adding members)

create or replace function public.create_chat_group(
  p_name text,
  p_description text default null,
  p_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as '
declare
  gid uuid;
  uid uuid := auth.uid();
  mid uuid;
begin
  if uid is null then
    raise exception ''Not authenticated'';
  end if;
  if not public.is_active_member() and not public.is_admin() then
    raise exception ''Only active members can create groups'';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception ''Group name is required'';
  end if;

  insert into public.chat_groups (name, description, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_description, '''')), ''''), uid)
  returning id into gid;

  insert into public.chat_group_members (group_id, user_id)
  values (gid, uid)
  on conflict do nothing;

  if p_member_ids is not null then
    foreach mid in array p_member_ids loop
      if mid is distinct from uid then
        insert into public.chat_group_members (group_id, user_id)
        values (gid, mid)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return gid;
end;
';

grant execute on function public.create_chat_group(text, text, uuid[]) to authenticated;
