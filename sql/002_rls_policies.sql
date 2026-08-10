-- =========================================================================
-- ROW LEVEL SECURITY - this is what actually enforces:
--   "members access their OWN info; admins manage day-to-day content;
--    only the super admin controls club settings, admin assignment, and
--    can add members outside the @umu.ac.ug domain."
-- Run AFTER 001_schema.sql.
-- =========================================================================

-- Helper: is the current user an admin OR super_admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql security definer stable;

-- Helper: is the current user THE (a) super admin?
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer stable;

-- Helper: is the current user an active (approved) member?
create or replace function public.is_active_member()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and membership_status = 'active'
  );
$$ language sql security definer stable;

-- =========================================================================
-- PROFILES
-- =========================================================================
alter table public.profiles enable row level security;

-- Members read their own row; admins/super admin read everyone's (needed
-- for the member directory, approvals, and assigning admin access).
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Members may update their own row (name, phone, programme, bio, avatar) -
-- but NOT their own role/membership_status, blocked by the trigger below.
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

-- Column-level protection (RLS alone can't restrict specific columns on
-- UPDATE, so this trigger does it): only admins/super admin can change
-- membership_status/approval fields, and ONLY the super admin can change
-- `role` or `assigned_admin_*` (i.e. "admins are assigned by the super
-- admin", not by each other or by themselves).
create or replace function public.protect_sensitive_profile_fields()
returns trigger as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  if (new.assigned_admin_by is distinct from old.assigned_admin_by
      or new.assigned_admin_at is distinct from old.assigned_admin_at)
     and not public.is_super_admin() then
    raise exception 'Only the super admin can assign admin access';
  end if;

  if public.is_admin() then
    return new; -- admins (incl. super admin) may change status/approval fields
  end if;

  if new.membership_status is distinct from old.membership_status
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.failed_login_count is distinct from old.failed_login_count
     or new.locked_until is distinct from old.locked_until
     or new.added_by_super_admin is distinct from old.added_by_super_admin
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger protect_sensitive_fields
  before update on public.profiles
  for each row execute procedure public.protect_sensitive_profile_fields();

-- Only the super admin may delete a profile row directly. (Actual account
-- deletion should go through the admin-delete-user Edge Function using
-- the service-role key, which independently checks is_super_admin() before
-- calling auth.admin.deleteUser(). This policy is defense-in-depth.)
create policy "profiles_delete_super_admin_only"
  on public.profiles for delete
  using (public.is_super_admin());

-- =========================================================================
-- CLUB SETTINGS - public read (landing/about pages need it before login),
-- ONLY the super admin can write. This is "the super admin should have
-- highest priority access to the club information."
-- =========================================================================
alter table public.club_settings enable row level security;
create policy "club_settings_public_read" on public.club_settings for select using (true);
create policy "club_settings_super_admin_write" on public.club_settings for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- =========================================================================
-- LEADERS / NEWS - public read, admin (or super admin) write.
-- =========================================================================
alter table public.leaders enable row level security;
create policy "leaders_public_read" on public.leaders for select using (true);
create policy "leaders_admin_write" on public.leaders for all using (public.is_admin()) with check (public.is_admin());

alter table public.news enable row level security;
create policy "news_public_read" on public.news for select using (true);
create policy "news_admin_write" on public.news for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- ACTIVITIES - public read (marketing value), admin write. Joining/RSVPing
-- requires being an active member; a member sees only their OWN RSVPs
-- (their own info, per the requirement), admins see everyone's.
-- =========================================================================
alter table public.activities enable row level security;
create policy "activities_public_read" on public.activities for select using (true);
create policy "activities_admin_write" on public.activities for all using (public.is_admin()) with check (public.is_admin());

alter table public.activity_participants enable row level security;
create policy "activity_participants_select_own_or_admin" on public.activity_participants
  for select using (user_id = auth.uid() or public.is_admin());
create policy "activity_participants_insert_own" on public.activity_participants
  for insert with check (user_id = auth.uid() and public.is_active_member());
create policy "activity_participants_update_own_or_admin" on public.activity_participants
  for update using (user_id = auth.uid() or public.is_admin());
create policy "activity_participants_delete_own_or_admin" on public.activity_participants
  for delete using (user_id = auth.uid() or public.is_admin());

-- =========================================================================
-- PROJECTS - internal club work, NOT public. Only active members can read
-- project listings; a member's OWN project_members rows are what shows up
-- as "their" projects. Admins manage projects and assignments.
-- =========================================================================
alter table public.projects enable row level security;
create policy "projects_read_members" on public.projects for select using (public.is_active_member() or public.is_admin());
create policy "projects_admin_write" on public.projects for all using (public.is_admin()) with check (public.is_admin());

alter table public.project_members enable row level security;
create policy "project_members_select_own_or_admin" on public.project_members
  for select using (user_id = auth.uid() or public.is_admin());
create policy "project_members_admin_write" on public.project_members
  for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- DISCUSSIONS (FORUM) - active members read/post; admins moderate/delete.
-- =========================================================================
alter table public.forum_topics enable row level security;
create policy "forum_topics_read_members" on public.forum_topics for select using (public.is_active_member() or public.is_admin());
create policy "forum_topics_insert_members" on public.forum_topics for insert with check (author_id = auth.uid() and public.is_active_member());
create policy "forum_topics_admin_moderate" on public.forum_topics for update using (public.is_admin());
create policy "forum_topics_admin_delete" on public.forum_topics for delete using (public.is_admin());

alter table public.forum_replies enable row level security;
create policy "forum_replies_read_members" on public.forum_replies for select using (public.is_active_member() or public.is_admin());
create policy "forum_replies_insert_members" on public.forum_replies for insert with check (
  author_id = auth.uid() and public.is_active_member()
  and not exists (select 1 from public.forum_topics t where t.id = topic_id and t.is_locked)
);
create policy "forum_replies_admin_delete" on public.forum_replies for delete using (public.is_admin());

-- =========================================================================
-- CONTACT MESSAGES - anyone (even logged out) can send one; only admins
-- read and reply.
-- =========================================================================
alter table public.contact_messages enable row level security;
create policy "contact_messages_public_insert" on public.contact_messages for insert with check (true);
create policy "contact_messages_admin_read" on public.contact_messages for select using (public.is_admin());
create policy "contact_messages_admin_update" on public.contact_messages for update using (public.is_admin());
create policy "contact_messages_admin_delete" on public.contact_messages for delete using (public.is_admin());

-- =========================================================================
-- SITE ANNOUNCEMENTS - public read (the homepage ticker), admin write.
-- =========================================================================
alter table public.site_announcements enable row level security;
create policy "site_announcements_public_read" on public.site_announcements for select using (true);
create policy "site_announcements_admin_write" on public.site_announcements for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- POSITIONS - public read (shown on the elections/apply page), admin write.
-- =========================================================================
alter table public.positions enable row level security;
create policy "positions_public_read" on public.positions for select using (true);
create policy "positions_admin_write" on public.positions for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- ELECTIONS - visible to active members (and admins). Candidate approval
-- and day-to-day management are admin actions; closing an election and
-- promoting winners is a super-admin-only action (see promote_election_winners
-- in 001_schema.sql).
-- =========================================================================
alter table public.elections enable row level security;
create policy "elections_read_members" on public.elections for select using (public.is_active_member() or public.is_admin());
create policy "elections_admin_write" on public.elections for all using (public.is_admin()) with check (public.is_admin());

alter table public.candidates enable row level security;
create policy "candidates_read_members" on public.candidates for select using (public.is_active_member() or public.is_admin());
-- A member may apply for themselves; admins approve/edit/remove any row.
create policy "candidates_insert_own" on public.candidates for insert with check (user_id = auth.uid() and public.is_active_member());
create policy "candidates_admin_write" on public.candidates for update using (public.is_admin());
create policy "candidates_admin_delete" on public.candidates for delete using (public.is_admin());

alter table public.votes enable row level security;
-- Members INSERT their own vote once, and can check *whether* they've
-- voted (select only their own row) - never anyone else's, never tallies.
create policy "votes_insert_own" on public.votes
  for insert with check (voter_id = auth.uid() and public.is_active_member());
create policy "votes_select_own_only" on public.votes
  for select using (voter_id = auth.uid());
-- No update/delete policy for anyone (including admins) => votes are immutable.

-- =========================================================================
-- FEEDBACK / SURVEYS - active members read active forms and submit one
-- response each; admins create forms; only the super admin edits or
-- deletes an EXISTING form/question (protects survey data already in use).
-- =========================================================================
alter table public.feedback_forms enable row level security;
create policy "feedback_forms_read_active" on public.feedback_forms
  for select using (is_active = true or public.is_admin());
create policy "feedback_forms_admin_insert" on public.feedback_forms
  for insert with check (public.is_admin());
create policy "feedback_forms_super_admin_update" on public.feedback_forms
  for update using (public.is_super_admin());
create policy "feedback_forms_super_admin_delete" on public.feedback_forms
  for delete using (public.is_super_admin());

alter table public.feedback_questions enable row level security;
create policy "feedback_questions_read" on public.feedback_questions
  for select using (
    public.is_admin()
    or exists (select 1 from public.feedback_forms f where f.id = form_id and f.is_active)
  );
create policy "feedback_questions_admin_insert" on public.feedback_questions
  for insert with check (public.is_admin());
create policy "feedback_questions_super_admin_update" on public.feedback_questions
  for update using (public.is_super_admin());
create policy "feedback_questions_super_admin_delete" on public.feedback_questions
  for delete using (public.is_super_admin());

alter table public.feedback_responses enable row level security;
create policy "feedback_responses_select_own_or_admin" on public.feedback_responses
  for select using (user_id = auth.uid() or public.is_admin());
create policy "feedback_responses_insert_own" on public.feedback_responses
  for insert with check (user_id = auth.uid() and public.is_active_member());

alter table public.feedback_answers enable row level security;
create policy "feedback_answers_select_own_or_admin" on public.feedback_answers
  for select using (
    public.is_admin()
    or exists (select 1 from public.feedback_responses r where r.id = response_id and r.user_id = auth.uid())
  );
create policy "feedback_answers_insert_own" on public.feedback_answers
  for insert with check (
    exists (select 1 from public.feedback_responses r where r.id = response_id and r.user_id = auth.uid())
  );

-- =========================================================================
-- LOGIN ATTEMPTS / AUDIT LOG - super-admin read only. No insert policy for
-- anon/authenticated - only service_role (Edge Functions) writes here,
-- which bypasses RLS entirely.
-- =========================================================================
alter table public.login_attempts enable row level security;
create policy "login_attempts_super_admin_read" on public.login_attempts for select using (public.is_super_admin());

alter table public.audit_log enable row level security;
create policy "audit_log_super_admin_read" on public.audit_log for select using (public.is_super_admin());
