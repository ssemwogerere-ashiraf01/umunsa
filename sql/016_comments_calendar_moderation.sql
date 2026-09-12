-- 016: Fix comments, nested replies, comment likes, calendar fields, notifications on admin posts

-- Comments: allow parent replies; point user_id at profiles for embeds
alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;

-- Prefer profiles FK (safe if already auth.users)
do $$
begin
  begin
    alter table public.post_comments
      drop constraint if exists post_comments_user_id_fkey;
  exception when others then null;
  end;
  begin
    alter table public.post_comments
      add constraint post_comments_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  exception when others then null;
  end;
end $$;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);
alter table public.comment_likes enable row level security;
drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select on public.comment_likes for select using (true);
drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert on public.comment_likes for insert with check (auth.uid() = user_id);
drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete on public.comment_likes for delete using (auth.uid() = user_id);

-- Calendar / deadline fields on admin content
alter table public.news
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists show_on_calendar boolean not null default true;

alter table public.activities
  add column if not exists ends_at timestamptz,
  add column if not exists show_on_calendar boolean not null default true;

alter table public.projects
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists show_on_calendar boolean not null default true;

alter table public.forum_topics
  add column if not exists ends_at timestamptz,
  add column if not exists show_on_calendar boolean not null default false;

-- Backfill starts from existing dates
update public.news set starts_at = coalesce(starts_at, published_at) where starts_at is null;
update public.activities set ends_at = coalesce(ends_at, activity_date + interval '3 hours') where ends_at is null and activity_date is not null;
update public.projects set starts_at = coalesce(starts_at, created_at) where starts_at is null;

-- Warnings for moderated members
alter table public.profiles
  add column if not exists moderation_warnings int not null default 0,
  add column if not exists last_moderation_warning text,
  add column if not exists last_moderation_at timestamptz;

-- Notify all active members when admin publishes news / activity / project
create or replace function public.notify_members_on_admin_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title_txt text;
  body_txt text;
  link_txt text;
  kind text;
begin
  kind := tg_argv[0];
  if kind = 'news' then
    title_txt := 'New post: ' || coalesce(new.title, 'News');
    body_txt := left(coalesce(new.content, ''), 140);
    link_txt := '/news-detail.html?id=' || new.id::text;
  elsif kind = 'activity' then
    title_txt := 'New activity: ' || coalesce(new.title, 'Activity');
    body_txt := coalesce(to_char(new.activity_date, 'DD Mon YYYY HH24:MI'), '');
    link_txt := '/activities.html';
  elsif kind = 'project' then
    title_txt := 'New project: ' || coalesce(new.title, 'Project');
    body_txt := left(coalesce(new.description, ''), 140);
    link_txt := '/projects.html';
  else
    return new;
  end if;

  insert into public.user_notifications (user_id, title, body, link)
  select p.id, title_txt, body_txt, link_txt
  from public.profiles p
  where p.membership_status = 'active';

  return new;
end;
$$;

drop trigger if exists news_notify_members on public.news;
create trigger news_notify_members
  after insert on public.news
  for each row execute function public.notify_members_on_admin_content('news');

drop trigger if exists activity_notify_members on public.activities;
create trigger activity_notify_members
  after insert on public.activities
  for each row execute function public.notify_members_on_admin_content('activity');

drop trigger if exists project_notify_members on public.projects;
create trigger project_notify_members
  after insert on public.projects
  for each row execute function public.notify_members_on_admin_content('project');

-- Allow members to read their own notification inserts already covered; service role inserts via security definer

comment on column public.news.ends_at is 'Optional deadline / end of relevance for calendar';
comment on column public.activities.ends_at is 'When the activity ends (calendar span)';
