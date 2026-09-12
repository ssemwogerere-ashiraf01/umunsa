-- Persist UMUNSA Quick Chat history per member
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text,
  title text not null default 'Chat',
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ai_chat_sessions_user_client_uidx
  on public.ai_chat_sessions (user_id, client_id)
  where client_id is not null;

create index if not exists ai_chat_sessions_user_updated_idx
  on public.ai_chat_sessions (user_id, updated_at desc);

alter table public.ai_chat_sessions enable row level security;

drop policy if exists ai_chat_sessions_select on public.ai_chat_sessions;
create policy ai_chat_sessions_select on public.ai_chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_insert on public.ai_chat_sessions;
create policy ai_chat_sessions_insert on public.ai_chat_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_update on public.ai_chat_sessions;
create policy ai_chat_sessions_update on public.ai_chat_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_delete on public.ai_chat_sessions;
create policy ai_chat_sessions_delete on public.ai_chat_sessions
  for delete using (auth.uid() = user_id);
