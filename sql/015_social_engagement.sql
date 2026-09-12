-- Post likes & comments (news + forum topics)
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('news','forum_topic','activity')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('news','forum_topic','activity')),
  target_id uuid not null,
  body text not null,
  mentioned_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists post_likes_target_idx on public.post_likes (target_type, target_id);
create index if not exists post_comments_target_idx on public.post_comments (target_type, target_id, created_at);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes for select using (true);
drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes for insert with check (auth.uid() = user_id);
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes for delete using (auth.uid() = user_id);

drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments for select using (true);
drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments for insert with check (auth.uid() = user_id);
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments for delete using (auth.uid() = user_id or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin')
));

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists user_notifications_select on public.user_notifications;
create policy user_notifications_select on public.user_notifications for select using (auth.uid() = user_id);
drop policy if exists user_notifications_update on public.user_notifications;
create policy user_notifications_update on public.user_notifications for update using (auth.uid() = user_id);
