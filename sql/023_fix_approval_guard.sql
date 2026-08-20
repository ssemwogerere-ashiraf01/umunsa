-- 023: Allow admins/service role to set approval fields when creating members

create or replace function public.protect_sensitive_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Service role (edge functions) has no auth.uid(); admins may change status.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  if (new.assigned_admin_by is distinct from old.assigned_admin_by
      or new.assigned_admin_at is distinct from old.assigned_admin_at)
     and not public.is_super_admin() then
    raise exception 'Only the super admin can assign admin access';
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
     or new.approved_at is distinct from old.approved_at
     or new.added_by_super_admin is distinct from old.added_by_super_admin then
    raise exception 'You cannot change approval fields';
  end if;

  if new.failed_login_count is distinct from old.failed_login_count
     or new.locked_until is distinct from old.locked_until then
    raise exception 'You cannot change lockout fields';
  end if;

  return new;
end;
$fn$;
