-- 014: Canonical hostels / halls list (reference for forms and filters)

create table if not exists public.hostels (
  id serial primary key,
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.hostels (name, sort_order) values
  ('Katonga hostel', 1),
  ('Bbosa hostel', 2),
  ('Kavuma hostel', 3),
  ('Lwanga hostel', 4),
  ('Byaben hostel', 5),
  ('Kololo hostel', 6),
  ('Ivis hostel', 7),
  ('Canan hostel', 8),
  ('Fountain hostel', 9),
  ('Angels hostel', 10),
  ('Wamala hostel', 11),
  ('Mugagga hostel', 12),
  ('Micheal hall', 13),
  ('Onyango hall', 14),
  ('Campbell hall', 15),
  ('Mukasa hall', 16),
  ('Martyrs hall', 17),
  ('Haflet hall', 18),
  ('Carabine hall', 19)
on conflict (name) do update set sort_order = excluded.sort_order, is_active = true;

-- Optional: remove obsolete labels if they were stored only as free text elsewhere
-- (profiles.hostel stays free text so "Other" custom names still work)

alter table public.hostels enable row level security;
drop policy if exists "hostels_public_read" on public.hostels;
create policy "hostels_public_read" on public.hostels for select using (true);
drop policy if exists "hostels_admin_write" on public.hostels;
create policy "hostels_admin_write" on public.hostels for all using (public.is_admin()) with check (public.is_admin());
