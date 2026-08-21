-- 022: Rename Ministers → Secretaries; Secretary → General Secretary

-- Core executive rename
update public.positions set name = 'General Secretary', name_luganda = 'Omuwandiisi'
  where name = 'Secretary';

update public.positions set name = 'Deputy General Secretary', name_luganda = 'Amyuka Omuwandiisi'
  where name = 'Deputy Secretary';

-- Ministers → Secretaries (keep Luganda titles)
update public.positions set name = 'Information Secretary'
  where name = 'Information Minister';

update public.positions set name = 'Deputy Information Secretary'
  where name = 'Deputy Information Minister';

update public.positions set name = 'Ethics Secretary'
  where name = 'Ethics Minister';

update public.positions set name = 'Deputy Ethics Secretary'
  where name = 'Deputy Ethics Minister';

update public.positions set name = 'Games & Sports Secretary'
  where name = 'Games & Sports Minister';

update public.positions set name = 'Projects Secretary'
  where name = 'Projects Minister';

update public.positions set name = 'Public Relations Secretary'
  where name = 'Minister of Public Relations';

update public.positions set name = 'Deputy Public Relations Secretary'
  where name = 'Deputy Minister of Public Relations';

update public.positions set name = 'Culture Secretary'
  where name = 'Minister of Culture';

update public.positions set name = 'Deputy Culture Secretary'
  where name = 'Deputy Minister of Culture';

update public.positions set name = 'Community Services Secretary'
  where name = 'Community Services Minister';

-- Re-seed full list with new names (safe upsert for any missing rows)
insert into public.positions (name, name_luganda, category, requires_fee, application_fee, display_order) values
  ('President', 'Ssentebe', 'Executive', true, 20000, 1),
  ('Vice President', 'Amyuka Ssentebe', 'Executive', true, 20000, 2),
  ('Speaker', 'Omukubiriza w''Olukiiko', 'Executive', true, 20000, 3),
  ('Deputy Speaker', 'Amyuka Omukubiriza w''Olukiiko', 'Executive', true, 10000, 4),
  ('General Secretary', 'Omuwandiisi', 'Executive', true, 20000, 5),
  ('Deputy General Secretary', 'Amyuka Omuwandiisi', 'Executive', true, 10000, 6),
  ('Treasurer', 'Omuwanika', 'Executive', true, 20000, 7),
  ('Deputy Treasurer', 'Amyuka Omuwanika', 'Executive', true, 10000, 8),
  ('Information Secretary', 'Ow''amawulire', 'Executive', true, 10000, 9),
  ('Deputy Information Secretary', 'Amyuka Ow''amawulire', 'Executive', true, 10000, 10),
  ('Ssenga', 'Ssenga', 'Cultural', true, 10000, 11),
  ('Deputy Ssenga', 'Amyuka Ssenga', 'Cultural', true, 10000, 12),
  ('Kkojja', 'Kkojja', 'Cultural', true, 10000, 13),
  ('Deputy Kkojja', 'Amyuka Kkojja', 'Cultural', true, 10000, 14),
  ('Ethics Secretary', 'Ow''ebyempisa', 'Executive', true, 10000, 15),
  ('Deputy Ethics Secretary', 'Amyuka Ow''ebyempisa', 'Executive', true, 10000, 16),
  ('Legal Advisor', 'Munnamateeka', 'Executive', true, 10000, 17),
  ('Games & Sports Secretary', 'Ow''ebyemizannyo', 'Executive', true, 10000, 18),
  ('Projects Secretary', 'Ow''ebyenkulaakulana', 'Executive', true, 10000, 19),
  ('Chief Coordinator', 'Ssaabakwanaganya w''emirimu', 'Executive', true, 10000, 20),
  ('Public Relations Secretary', 'Omutabaganya w''Amawangwa', 'Executive', true, 10000, 21),
  ('Deputy Public Relations Secretary', null, 'Executive', true, 10000, 22),
  ('Chief Mobilizer', 'Ssaabakunzi', 'Executive', true, 10000, 23),
  ('Culture Secretary', 'Ow''ebyobuwangwa', 'Executive', true, 10000, 24),
  ('Deputy Culture Secretary', 'Amyuka Ow''ebyobuwangwa', 'Executive', true, 10000, 25),
  ('Games & Sports Girls', null, 'Executive', true, 10000, 26),
  ('Community Services Secretary', 'Owabulungi Bwa Nsi', 'Executive', true, 10000, 27),
  ('Faculty Representative / Coordinator', null, 'Faculty Rep', true, 10000, 28),
  ('Hall / Hostel Representative', null, 'Hall Rep', true, 10000, 29)
on conflict (name) do update set
  name_luganda = excluded.name_luganda,
  category = excluded.category,
  application_fee = excluded.application_fee,
  display_order = excluded.display_order;
