-- 010: Auto-approve members, election applications flag, leadership fields

-- Operational setting: when true, new self-registrations become active immediately
insert into public.club_settings (key, value)
values ('auto_approve_members', 'false'::jsonb)
on conflict (key) do nothing;

insert into public.club_settings (key, value)
values ('current_leadership_term', '"2025/26"'::jsonb)
on conflict (key) do nothing;

-- Allow admins to stop new candidacy applications without fully closing the election
alter table public.elections
  add column if not exists accepting_applications boolean not null default true;

comment on column public.elections.accepting_applications is
  'When false, members cannot submit new candidacy applications. Voting can still follow election.status.';

-- Leadership: display name (when not linked to a profile) + human term label
alter table public.leaders
  add column if not exists full_name text;

alter table public.leaders
  add column if not exists term_label text;

comment on column public.leaders.full_name is 'Display name when user_id is null or as override';
comment on column public.leaders.term_label is 'e.g. 2025/26';

-- New signups: respect auto_approve_members (still active if super-admin created)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  auto_approve boolean := false;
  is_super_added boolean := false;
begin
  is_super_added := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);

  begin
    select coalesce((value #>> '{}')::boolean, false)
      into auto_approve
      from public.club_settings
     where key = 'auto_approve_members';
  exception when others then
    auto_approve := false;
  end;

  insert into public.profiles (
    id, email, full_name, phone, registration_number, hostel, faculty,
    added_by_super_admin, membership_status, onboarding_completed
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(coalesce(new.raw_user_meta_data->>'phone', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'registration_number', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'hostel', ''), ''),
    nullif(coalesce(new.raw_user_meta_data->>'faculty', ''), ''),
    is_super_added,
    case
      when is_super_added or auto_approve then 'active'::membership_status
      else 'pending'::membership_status
    end,
    case when is_super_added or auto_approve then true else false end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Admins may update operational settings (not full club profile text)
drop policy if exists "club_settings_admin_ops_write" on public.club_settings;
create policy "club_settings_admin_ops_write"
  on public.club_settings
  for all
  using (
    public.is_admin()
    and key in ('auto_approve_members', 'current_leadership_term')
  )
  with check (
    public.is_admin()
    and key in ('auto_approve_members', 'current_leadership_term')
  );
