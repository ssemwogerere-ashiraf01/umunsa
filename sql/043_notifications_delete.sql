-- 043: Allow members to clear (delete) their own notifications
drop policy if exists user_notifications_delete on public.user_notifications;
create policy user_notifications_delete on public.user_notifications
  for delete using (auth.uid() = user_id);
