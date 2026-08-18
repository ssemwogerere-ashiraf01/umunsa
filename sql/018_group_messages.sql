-- 018: Group chats

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_messages_group on public.group_messages(group_id, created_at);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.group_messages enable row level security;

-- Members can see groups they belong to
drop policy if exists cg_select on public.chat_groups;
create policy cg_select on public.chat_groups for select using (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = id and m.user_id = auth.uid()
  )
  or public.is_admin()
);

drop policy if exists cg_insert on public.chat_groups;
create policy cg_insert on public.chat_groups for insert with check (
  auth.uid() = created_by and public.is_active_member()
);

drop policy if exists cg_update on public.chat_groups;
create policy cg_update on public.chat_groups for update using (
  created_by = auth.uid() or public.is_admin()
);

drop policy if exists cgm_select on public.chat_group_members;
create policy cgm_select on public.chat_group_members for select using (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = chat_group_members.group_id and m.user_id = auth.uid()
  )
  or public.is_admin()
);

drop policy if exists cgm_insert on public.chat_group_members;
create policy cgm_insert on public.chat_group_members for insert with check (
  public.is_active_member()
  and (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid()
    )
    or public.is_admin()
  )
);

drop policy if exists cgm_delete on public.chat_group_members;
create policy cgm_delete on public.chat_group_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid())
  or public.is_admin()
);

drop policy if exists gm_select on public.group_messages;
create policy gm_select on public.group_messages for select using (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = group_messages.group_id and m.user_id = auth.uid()
  )
);

drop policy if exists gm_insert on public.group_messages;
create policy gm_insert on public.group_messages for insert with check (
  auth.uid() = sender_id
  and public.is_active_member()
  and exists (
    select 1 from public.chat_group_members m
    where m.group_id = group_messages.group_id and m.user_id = auth.uid()
  )
);
