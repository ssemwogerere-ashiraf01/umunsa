-- =========================================================================
-- NKOBAZAMBOGO STUDENTS' ASSOCIATION (Uganda Martyrs University, Nkozi)
-- CORE SCHEMA (Supabase / Postgres)
-- =========================================================================
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Run the files in this folder IN ORDER:
--   001_schema.sql  (this file)
--   002_rls_policies.sql
--   003_storage.sql
--   004_email_domain_and_roles.sql
-- Safe to run once on a fresh project. Re-running will error on existing
-- objects (by design, so you don't accidentally wipe data).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -------------------------------------------------------------------------
-- Permission tier. 'admin' is assigned BY a super_admin (see 004). There is
-- no self-service way to become admin or super_admin.
create type user_role as enum ('member', 'admin', 'super_admin');

-- Membership lifecycle. New sign-ups start 'pending' until an admin/super
-- admin approves them; this is the "membership status" a member sees on
-- their own dashboard.
create type membership_status as enum ('pending', 'active', 'suspended', 'rejected');

create type project_status as enum ('planned', 'ongoing', 'completed');

create type election_status as enum ('draft', 'upcoming', 'active', 'closed');

-- -------------------------------------------------------------------------
-- 2. CLUB SETTINGS  (flexible key/value table the Super Admin edits from
--    the Super Admin dashboard - about-us copy, motto, contact info, hero
--    tagline - without needing a code change)
-- -------------------------------------------------------------------------
create table public.club_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.club_settings (key, value) values
  ('club_name', '"Nkobazambogo Students'' Association"'),
  ('club_full_name', '"Uganda Martyrs University Nkobazambogo Students'' Association"'),
  ('motto', '"Virtute et Sapientia Duc Mundum \u2014 In Virtue and Wisdom Lead the World"'),
  ('about_summary', '"A community of Uganda Martyrs University students at Nkozi, organised around shared activities, projects, and mutual support."'),
  ('contact_email', '"nsa@umu.ac.ug"'),
  ('contact_phone', '""'),
  ('campus_location', '"Uganda Martyrs University, Nkozi, Mpigi District, Uganda"');

-- -------------------------------------------------------------------------
-- 3. PROFILES  (extends auth.users - Supabase Auth already stores
--    email/password identity; this table holds everything else)
-- -------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null unique,
  full_name             text not null,
  phone                 text,
  programme             text,   -- course / programme of study
  year_of_study         int,
  bio                   text,
  avatar_url            text,

  role                  user_role not null default 'member',
  membership_status     membership_status not null default 'pending',
  onboarding_completed  boolean not null default false,

  -- security / session control
  failed_login_count    int not null default 0,
  locked_until          timestamptz,
  last_activity_at      timestamptz,

  approved_by           uuid references public.profiles(id),
  approved_at           timestamptz,

  -- audit trail for "admins are assigned access by the super admin"
  assigned_admin_by     uuid references public.profiles(id),
  assigned_admin_at     timestamptz,

  -- true when this row was created directly by a super admin (bypassing
  -- the @umu.ac.ug self-registration restriction) rather than self sign-up
  added_by_super_admin  boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is 'One row per user. Sensitive fields (role, membership_status) are admin/super-admin-only via RLS + trigger below.';

-- Auto-create a profile row whenever someone signs up (email/password).
-- Reads the flag set by the admin-create-user Edge Function so we know
-- whether this account was added by a super admin (any email domain
-- allowed) or is a normal self-registration (@umu.ac.ug only - enforced
-- in 004_email_domain_and_roles.sql).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, added_by_super_admin, membership_status, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false),
    case when coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
         then 'active'::membership_status
         else 'pending'::membership_status end,
    coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------------------------
-- 4. LEADERS (executive committee, shown on the public Leadership page)
-- -------------------------------------------------------------------------
create table public.leaders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  position      text not null,
  term_start    date,
  term_end      date,
  is_current    boolean not null default true,
  bio           text,
  photo_url     text,
  display_order int default 0
);

-- -------------------------------------------------------------------------
-- 5. NEWS  (public announcements)
-- -------------------------------------------------------------------------
create table public.news (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  author_id     uuid references public.profiles(id),
  image_url     text,
  is_featured   boolean not null default false,
  published_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 6. CLUB ACTIVITIES  (events run by the association - members "join" by
--    RSVPing; each member's own participation is what they see on their
--    dashboard).
-- -------------------------------------------------------------------------
create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  activity_date   timestamptz not null,
  location        text,
  image_url       text,
  max_participants int,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create table public.activity_participants (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references public.activities(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'interested' check (status in ('interested','going','attended','cancelled')),
  joined_at     timestamptz not null default now(),
  unique (activity_id, user_id)
);

-- -------------------------------------------------------------------------
-- 7. PROJECTS  (club projects - members see only the projects they are
--    assigned to; admins/super admin manage all projects and assignments).
-- -------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        project_status not null default 'planned',
  start_date    date,
  end_date      date,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.project_members (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role_in_project text not null default 'member' check (role_in_project in ('lead','member')),
  assigned_by    uuid references public.profiles(id),
  assigned_at    timestamptz not null default now(),
  unique (project_id, user_id)
);

-- -------------------------------------------------------------------------
-- 8. DISCUSSIONS (FORUM)  - any active member can start topics/reply;
--    admins/super admin moderate.
-- -------------------------------------------------------------------------
create table public.forum_topics (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text,
  category     text,
  author_id    uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  is_locked    boolean not null default false
);

create table public.forum_replies (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.forum_topics(id) on delete cascade,
  author_id    uuid references public.profiles(id),
  content      text not null,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 9. CONTACT MESSAGES  (public "Contact Us" form - no login required to
--    send one; admins/super admin read and reply from the admin panel)
-- -------------------------------------------------------------------------
create table public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  topic        text,
  message      text not null,
  status       text not null default 'new' check (status in ('new','read','replied','archived')),
  admin_reply  text,
  replied_by   uuid references public.profiles(id),
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 10. SITE ANNOUNCEMENTS  (short scrolling ticker on public pages)
-- -------------------------------------------------------------------------
create table public.site_announcements (
  id             uuid primary key default gen_random_uuid(),
  message        text not null,
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 9b. LEADERSHIP POSITIONS  (the fixed list of electable offices - seeded
--     below with the real BANKOSA / Nkobazambogo Students' Association
--     position list so the Elections module has something to attach
--     candidates to out of the box. Edit/add rows any time.)
-- -------------------------------------------------------------------------
create table public.positions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,       -- e.g. "President (Ssentebe)"
  name_luganda      text,                        -- e.g. "Ssentebe"
  category          text,                        -- e.g. "Executive", "Faculty Rep", "Hall Rep"
  requires_fee      boolean not null default true,
  application_fee   numeric(10,2) not null default 10000,
  display_order     int not null default 0
);

insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order) values
  ('President',                          'Ssentebe',                               'Executive', true, 20000, 1),
  ('Vice President',                     'Amyuka Ssentebe',                        'Executive', true, 20000, 2),
  ('Speaker',                            'Omukubiriza w''Olukiiko',                'Executive', true, 20000, 3),
  ('Deputy Speaker',                     'Amyuka Omukubiriza w''Olukiiko',         'Executive', true, 10000, 4),
  ('Secretary',                          'Omuwandiisi',                            'Executive', true, 20000, 5),
  ('Deputy Secretary',                   'Amyuka Omuwandiisi',                     'Executive', true, 10000, 6),
  ('Treasurer',                          'Omuwanika',                              'Executive', true, 10000, 7),
  ('Deputy Treasurer',                   'Amyuka Omuwanika',                       'Executive', true, 10000, 8),
  ('Information Minister',               'Ow''amawulire',                          'Executive', true, 10000, 9),
  ('Deputy Information Minister',        'Amyuka Ow''amawulire',                   'Executive', true, 10000, 10),
  ('Ssenga',                             'Ssenga',                                 'Cultural',  true, 10000, 11),
  ('Deputy Ssenga',                      'Amyuka Ssenga',                          'Cultural',  true, 10000, 12),
  ('Kkojja',                             'Kkojja',                                 'Cultural',  true, 10000, 13),
  ('Deputy Kkojja',                      'Amyuka Kkojja',                          'Cultural',  true, 10000, 14),
  ('Ethics Minister',                    'Ow''ebyempisa',                          'Executive', true, 10000, 15),
  ('Deputy Ethics Minister',             'Amyuka Ow''ebyempisa',                   'Executive', true, 10000, 16),
  ('Legal Advisor',                      'Munnamateeka',                          'Executive', true, 10000, 17),
  ('Games & Sports Minister',            'Ow''ebyemizannyo',                       'Executive', true, 10000, 18),
  ('Projects Minister',                  'Ow''ebyenkulaakulana',                   'Executive', true, 10000, 19),
  ('Chief Coordinator',                  'Ssaabakwanaganya w''emirimu',            'Executive', true, 10000, 20),
  ('Minister of Public Relations',       'Omutabaganya w''Amawangwa',              'Executive', true, 10000, 21),
  ('Deputy Minister of Public Relations', null,                                    'Executive', true, 10000, 22),
  ('Chief Mobilizer',                    'Ssaabakunzi',                            'Executive', true, 10000, 23),
  ('Minister of Culture',                'Ow''ebyobuwangwa',                       'Executive', true, 10000, 24),
  ('Deputy Minister of Culture',         'Amyuka Ow''ebyobuwangwa',                'Executive', true, 10000, 25),
  ('Games & Sports Girls',               null,                                    'Executive', true, 10000, 26),
  ('Community Services Minister',       'Owabulungi Bwa Nsi',                     'Executive', true, 10000, 27),
  ('Faculty Representative / Coordinator', null,                                  'Faculty Rep', true, 10000, 28),
  ('Hall / Hostel Representative',       null,                                    'Hall Rep',   true, 10000, 29);

-- -------------------------------------------------------------------------
-- 9c. ELECTIONS
-- -------------------------------------------------------------------------
create table public.elections (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  start_date    timestamptz not null,
  end_date      timestamptz not null,
  status        election_status not null default 'draft',
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.candidates (
  id                    uuid primary key default gen_random_uuid(),
  election_id           uuid not null references public.elections(id) on delete cascade,
  user_id               uuid not null references public.profiles(id),
  position_id           uuid not null references public.positions(id),
  manifesto             text,
  photo_url             text,
  approved              boolean not null default false,
  application_fee_paid  boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (election_id, user_id, position_id)
);

-- Votes: one row per ballot. RLS below never exposes the voter_id ->
-- candidate_id link to anyone (including admins) except via the
-- tamper-evident, counts-only election_results() function.
create table public.votes (
  id             uuid primary key default gen_random_uuid(),
  election_id    uuid not null references public.elections(id) on delete cascade,
  position_id    uuid not null references public.positions(id),
  voter_id       uuid not null references public.profiles(id),
  candidate_id   uuid not null references public.candidates(id),
  voted_at       timestamptz not null default now(),
  unique (election_id, position_id, voter_id)
);

-- -------------------------------------------------------------------------
-- 9d. FEEDBACK / SURVEYS
-- -------------------------------------------------------------------------
create table public.feedback_forms (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create table public.feedback_questions (
  id             uuid primary key default gen_random_uuid(),
  form_id        uuid not null references public.feedback_forms(id) on delete cascade,
  question_text  text not null,
  question_type  text not null default 'text' check (question_type in ('text','rating','multiple_choice')),
  options        jsonb,               -- for multiple_choice: e.g. ["Yes","No","Not sure"]
  is_required    boolean not null default false,
  display_order  int not null default 0
);

create table public.feedback_responses (
  id                  uuid primary key default gen_random_uuid(),
  form_id             uuid not null references public.feedback_forms(id) on delete cascade,
  user_id             uuid references public.profiles(id),
  submitted_email     text,   -- kept even if the user's account is later deleted
  submitted_username  text,
  submitted_at        timestamptz not null default now()
);

create table public.feedback_answers (
  id            uuid primary key default gen_random_uuid(),
  response_id   uuid not null references public.feedback_responses(id) on delete cascade,
  question_id   uuid not null references public.feedback_questions(id) on delete cascade,
  answer_text   text
);

-- Public tally function for elections: returns counts only, never
-- who-voted-for-whom.
create or replace function public.election_results(p_election_id uuid)
returns table(candidate_id uuid, position_id uuid, vote_count bigint)
language sql security definer stable as $$
  select candidate_id, position_id, count(*) as vote_count
  from public.votes
  where election_id = p_election_id
  group by candidate_id, position_id;
$$;

-- Only the super admin may close an election and promote winners to the
-- public Leadership page (mirrors "critical actions" being reserved for
-- the super admin). Picks exactly one winner per position: the candidate
-- with the most votes in that position for this election.
create or replace function public.promote_election_winners(p_election_id uuid)
returns void
language plpgsql security definer as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can close an election and promote winners.';
  end if;

  insert into public.leaders (user_id, position, is_current, display_order)
  select winner.user_id, winner.position_name, true, 0
  from (
    select distinct on (c.position_id)
      c.user_id, p.name as position_name, count(v.id) as vote_count
    from public.candidates c
    join public.positions p on p.id = c.position_id
    left join public.votes v on v.candidate_id = c.id and v.election_id = p_election_id
    where c.election_id = p_election_id and c.approved = true
    group by c.id, c.position_id, c.user_id, p.name
    order by c.position_id, count(v.id) desc
  ) as winner;

  update public.elections set status = 'closed' where id = p_election_id;
end;
$$;


create table public.login_attempts (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  success      boolean not null,
  ip_address   text,
  attempted_at timestamptz not null default now()
);

create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id),
  action       text not null,
  target_table text,
  target_id    text,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 12. updated_at trigger for profiles / club_settings
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger club_settings_set_updated_at
  before update on public.club_settings
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------------
-- 13. INDEXES FOR PERFORMANCE
-- -------------------------------------------------------------------------
create index idx_profiles_membership_status on public.profiles(membership_status);
create index idx_profiles_role on public.profiles(role);
create index idx_activity_participants_user on public.activity_participants(user_id);
create index idx_project_members_user on public.project_members(user_id);
create index idx_forum_replies_topic on public.forum_replies(topic_id);
create index idx_login_attempts_email_time on public.login_attempts(email, attempted_at);
create index idx_contact_messages_status on public.contact_messages(status);
create index idx_candidates_election on public.candidates(election_id);
create index idx_votes_election_position on public.votes(election_id, position_id);
create index idx_feedback_responses_form on public.feedback_responses(form_id);
create index idx_feedback_answers_response on public.feedback_answers(response_id);
create index idx_news_published on public.news(published_at);
