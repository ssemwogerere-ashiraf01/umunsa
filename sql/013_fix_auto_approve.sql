-- 013: Fix auto-approve registration

insert into public.club_settings ("key", value)
values ('auto_approve_members', 'false'::jsonb)
on conflict ("key") do nothing;

create or replace function public.is_auto_approve_enabled()
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v jsonb;
  s text;
begin
  select value into v
  from public.club_settings
  where "key" = 'auto_approve_members';

  if v is null then
    return false;
  end if;

  if jsonb_typeof(v) = 'boolean' then
    return (v = 'true'::jsonb);
  end if;

  if jsonb_typeof(v) = 'string' then
    s := lower(trim(both '"' from (v #>> '{}')));
    return s in ('true', '1', 't', 'yes', 'on');
  end if;

  if jsonb_typeof(v) = 'number' then
    return (v #>> '{}') = '1';
  end if;

  s := lower(trim(both from coalesce(v #>> '{}', v::text, 'false')));
  s := trim(both '"' from s);
  return s in ('true', '1', 't', 'yes', 'on');
end;
$fn$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  auto_approve boolean := false;
  is_super_added boolean := false;
begin
  is_super_added := coalesce((new.raw_app_meta_data->>'added_by_super_admin')::boolean, false);

  begin
    auto_approve := public.is_auto_approve_enabled();
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
$fn$;

create or replace function public.maybe_auto_approve_member(p_user_id uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid;
  current_status public.membership_status;
begin
  uid := coalesce(p_user_id, auth.uid());
  if uid is null then
    return 'no_user';
  end if;

  if auth.uid() is distinct from uid and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  if not public.is_auto_approve_enabled() then
    return 'auto_approve_off';
  end if;

  select membership_status into current_status
  from public.profiles
  where id = uid;

  if current_status is null then
    return 'no_profile';
  end if;

  if current_status = 'pending' then
    perform set_config('app.allow_auto_approve', 'on', true);
    update public.profiles
    set membership_status = 'active',
        onboarding_completed = true,
        updated_at = now()
    where id = uid
      and membership_status = 'pending';
    perform set_config('app.allow_auto_approve', 'off', true);
    return 'activated';
  end if;

  return current_status::text;
end;
$fn$;

create or replace function public.protect_sensitive_profile_fields()
returns trigger
language plpgsql
as $fn$
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
    return new;
  end if;

  if new.membership_status is distinct from old.membership_status then
    if old.membership_status = 'pending'
       and new.membership_status = 'active'
       and (
         current_setting('app.allow_auto_approve', true) = 'on'
         or (new.id = auth.uid() and public.is_auto_approve_enabled())
       ) then
      return new;
    end if;
    raise exception 'You cannot change your own membership status';
  end if;

  if new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception 'You cannot change approval fields';
  end if;

  return new;
end;
$fn$;

grant execute on function public.is_auto_approve_enabled() to authenticated, anon;
grant execute on function public.maybe_auto_approve_member(uuid) to authenticated;
