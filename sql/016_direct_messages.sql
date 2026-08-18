-- 016: Direct messages + personal notes (drafts)

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint dm_not_self check (sender_id <> recipient_id)
);

create index if not exists idx_dm_sender on public.direct_messages(sender_id, created_at desc);
create index if not exists idx_dm_recipient on public.direct_messages(recipient_id, created_at desc);
create index if not exists idx_dm_pair on public.direct_messages(
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at desc
);

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.direct_messages enable row level security;
alter table public.personal_notes enable row level security;

drop policy if exists dm_select_own on public.direct_messages;
create policy dm_select_own on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists dm_insert_own on public.direct_messages;
create policy dm_insert_own on public.direct_messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_active_member()
  );

drop policy if exists dm_update_read on public.direct_messages;
create policy dm_update_read on public.direct_messages
  for update using (auth.uid() = recipient_id);

drop policy if exists notes_own on public.personal_notes;
create policy notes_own on public.personal_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
