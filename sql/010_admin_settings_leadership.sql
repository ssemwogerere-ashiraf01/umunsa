-- 010: Auto-approve members, election applications flag, leadership fields

insert into public.club_settings ("key", value)
values ('auto_approve_members', 'false'::jsonb)
on conflict ("key") do nothing;

insert into public.club_settings ("key", value)
values ('current_leadership_term', '"2025/26"'::jsonb)
on conflict ("key") do nothing;

alter table public.elections
  add column if not exists accepting_applications boolean not null default true;

comment on column public.elections.accepting_applications is
  'When false, members cannot submit new candidacy applications.';

alter table public.leaders
  add column if not exists full_name text;

alter table public.leaders
  add column if not exists term_label text;

comment on column public.leaders.full_name is 'Display name when user_id is null or as override';
comment on column public.leaders.term_label is 'e.g. 2025/26';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  auto_approve boolean := false;
  is_super_added boolean := false;
  raw_auto text;
begin
  is_super_added := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);

  begin
    select value #>> '{}'
      into raw_auto
      from public.club_settings
     where "key" = 'auto_approve_members';
    auto_approve := lower(coalesce(raw_auto, 'false')) in ('true', '1', 't', 'yes');
  exception when others then
    auto_approve := false;
  end;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    registration_number,
    hostel,
    faculty,
    added_by_super_admin,
    membership_status,
    onboarding_completed
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
$fn$;

drop policy if exists "club_settings_admin_ops_write" on public.club_settings;

create policy "club_settings_admin_ops_write"
  on public.club_settings
  for all
  using (
    public.is_admin()
    and "key" in ('auto_approve_members', 'current_leadership_term')
  )
  with check (
    public.is_admin()
    and "key" in ('auto_approve_members', 'current_leadership_term')
  );
