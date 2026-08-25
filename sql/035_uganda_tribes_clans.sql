-- 035: Uganda tribes + clans reference tables (seeded)
create table if not exists public.tribes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ethnic_group text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tribe_id, name)
);

create index if not exists idx_clans_tribe_id on public.clans (tribe_id);
create index if not exists idx_tribes_name on public.tribes (name);

alter table public.profiles add column if not exists tribe text;
alter table public.profiles add column if not exists clan text;

-- Public read (dropdowns on application / profile forms)
alter table public.tribes enable row level security;
alter table public.clans enable row level security;
drop policy if exists tribes_select_public on public.tribes;
create policy tribes_select_public on public.tribes for select to anon, authenticated using (true);
drop policy if exists clans_select_public on public.clans;
create policy clans_select_public on public.clans for select to anon, authenticated using (true);
-- Super admin manage
drop policy if exists tribes_write_super on public.tribes;
create policy tribes_write_super on public.tribes for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists clans_write_super on public.clans;
create policy clans_write_super on public.clans for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Seed tribes + clans (safe to re-run)
insert into public.tribes (name, ethnic_group, display_order) values ('Baganda', 'Bantu', 1)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lugave (Pangolin)', 1 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ffumbe (Civet Cat)', 2 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngonge (Otter)', 3 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Njaza (Reedbuck)', 4 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nyonyi Nnyange (Egret)', 5 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mpologoma (Lion)', 6 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mbogo (Buffalo)', 7 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngo (Leopard)', 8 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kima (Vervet Monkey)', 9 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mamba (Lungfish)', 10 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kkobe (Yam)', 11 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nsenene (Grasshopper)', 12 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Musu (Cane Rat)', 13 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nte (Cow)', 14 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mutima (Heart)', 15 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kasimba (Genet)', 16 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kibabu', 17 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Engabi (Bushbuck)', 18 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nkima (White-Monkey)', 19 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mpindi (Cowpea)', 20 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nkejje (Cichlid)', 21 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Namungona (Crow)', 22 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mbwa (Dog)', 23 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Sekabaka', 24 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kiwere', 25 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Njovu (Elephant)', 26 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nsumba', 27 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kkengere', 28 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngali (Crested Crane)', 29 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Musugi', 30 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nnyonyi Musirimu', 31 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lukato', 32 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kayozi', 33 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nte-Nnume', 34 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mpeewo', 35 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mutima-Gwa-Nte', 36 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Babiito (Royal Lineage)', 37 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngana', 38 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lugave-Olukulu', 39 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kasimba-Omukuuma', 40 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mbwa-Omulondo', 41 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nkejje-Omusota', 42 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Namungona-Omusangi', 43 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kkobe-Omuleme', 44 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mpindi-Omukoola', 45 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Musu-Omukulu', 46 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nsenene-Omukubira', 47 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngo-Omukwenda', 48 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mbogo-Omutaka', 49 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mpologoma-Omukuku', 50 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ffumbe-Omutaka', 51 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lugave-Omutaka', 52 from public.tribes where name = 'Baganda' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Banyankole', 'Bantu', 2)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagahe (Striped Cow)', 1 from public.tribes where name = 'Banyankole' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasita (Polled Cow)', 2 from public.tribes where name = 'Banyankole' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abashambo (Red Cow / Leopard)', 3 from public.tribes where name = 'Banyankole' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abahiira (Black Cow)', 4 from public.tribes where name = 'Banyankole' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Basoga', 'Bantu', 3)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Igaga', 1 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Ngobi', 2 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Mukama', 3 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Kadhumbula', 4 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Nhaitemba', 5 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Kiberu', 6 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Mutyaba', 7 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Waako', 8 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Ghabula', 9 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baise-Munhana', 10 from public.tribes where name = 'Basoga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bakiga', 'Bantu', 4)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasigi', 1 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagyesera', 2 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abaniidde', 3 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abaghesi', 4 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abanhewa', 5 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abakimbiri', 6 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abazigaba', 7 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasiita', 8 from public.tribes where name = 'Bakiga' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Batooro', 'Bantu', 5)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ababiito', 1 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abahesi', 2 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagahe', 3 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasita', 4 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagaya', 5 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abacwa', 6 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasengya', 7 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasiita', 8 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abayaga', 9 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abahinda', 10 from public.tribes where name = 'Batooro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Banyoro', 'Bantu', 6)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ababiito', 1 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abahesi', 2 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagahe', 3 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasita', 4 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagaya', 5 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abacwa', 6 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasengya', 7 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasiita', 8 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abayaga', 9 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abahinda', 10 from public.tribes where name = 'Banyoro' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bagisu / Bamasaba', 'Bantu', 7)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mwambu (North Bugisu: Bakuyonjo, Bamudaki)', 1 from public.tribes where name = 'Bagisu / Bamasaba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Mubuya (Central Bugisu: Babuya, Basoba)', 2 from public.tribes where name = 'Bagisu / Bamasaba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Wanaale (South Bugisu: Bamaaki)', 3 from public.tribes where name = 'Bagisu / Bamasaba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bakonzo', 'Bantu', 8)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baswagha', 1 from public.tribes where name = 'Bakonzo' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Banisanza', 2 from public.tribes where name = 'Bakonzo' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bamate', 3 from public.tribes where name = 'Bakonzo' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bahira', 4 from public.tribes where name = 'Bakonzo' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bayira', 5 from public.tribes where name = 'Bakonzo' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Baamba', 'Bantu', 9)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Baswagha', 1 from public.tribes where name = 'Baamba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Banisanza', 2 from public.tribes where name = 'Baamba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bamate', 3 from public.tribes where name = 'Baamba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bahira', 4 from public.tribes where name = 'Baamba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bayira', 5 from public.tribes where name = 'Baamba' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bafumbira', 'Bantu', 10)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abanyiginya', 1 from public.tribes where name = 'Bafumbira' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abazigaba', 2 from public.tribes where name = 'Bafumbira' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagesera', 3 from public.tribes where name = 'Bafumbira' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasigi', 4 from public.tribes where name = 'Bafumbira' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bagwere', 'Bantu', 11)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakerekwa', 1 from public.tribes where name = 'Bagwere' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bagobya', 2 from public.tribes where name = 'Bagwere' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bamuti', 3 from public.tribes where name = 'Bagwere' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Badaka', 4 from public.tribes where name = 'Bagwere' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Basamia', 'Bantu', 12)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bahemeni', 1 from public.tribes where name = 'Basamia' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakhebele', 2 from public.tribes where name = 'Basamia' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakhone', 3 from public.tribes where name = 'Basamia' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bamulembo', 4 from public.tribes where name = 'Basamia' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Bagwe', 'Bantu', 13)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bahemeni', 1 from public.tribes where name = 'Bagwe' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakhebele', 2 from public.tribes where name = 'Bagwe' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakhone', 3 from public.tribes where name = 'Bagwe' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bamulembo', 4 from public.tribes where name = 'Bagwe' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Baruuli', 'Bantu', 14)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abakirya', 1 from public.tribes where name = 'Baruuli' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abakalangwe', 2 from public.tribes where name = 'Baruuli' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ababiito', 3 from public.tribes where name = 'Baruuli' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Banyala', 'Bantu', 15)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abakirya', 1 from public.tribes where name = 'Banyala' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abakalangwe', 2 from public.tribes where name = 'Banyala' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ababiito', 3 from public.tribes where name = 'Banyala' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Batuku', 'Bantu', 16)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagabu', 1 from public.tribes where name = 'Batuku' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abacwa', 2 from public.tribes where name = 'Batuku' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abayaga', 3 from public.tribes where name = 'Batuku' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Batwa', 'Bantu', 17)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abasigi', 1 from public.tribes where name = 'Batwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abazigaba', 2 from public.tribes where name = 'Batwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Abagesera', 3 from public.tribes where name = 'Batwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Acholi', 'River-Lake Nilotics', 18)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Payira', 1 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Patiko', 2 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Alero', 3 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Koc', 4 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lamogi', 5 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Puranga', 6 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Paico', 7 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Pader', 8 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Parabongo', 9 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Paimol', 10 from public.tribes where name = 'Acholi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Lango', 'River-Lake Nilotics', 19)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Atek', 1 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Imo', 2 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Inomo', 3 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Okarowok', 4 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bakan', 5 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Balam', 6 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Palam', 7 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Oroto', 8 from public.tribes where name = 'Lango' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Alur', 'River-Lake Nilotics', 20)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ukuru', 1 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'War', 2 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Panduru', 3 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Padyere', 4 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Paidha', 5 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Jukoth', 6 from public.tribes where name = 'Alur' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Jopadhola', 'River-Lake Nilotics', 21)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nyapolo', 1 from public.tribes where name = 'Jopadhola' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Bwibo', 2 from public.tribes where name = 'Jopadhola' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kwar Adhola', 3 from public.tribes where name = 'Jopadhola' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Amor', 4 from public.tribes where name = 'Jopadhola' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kwar Jagow', 5 from public.tribes where name = 'Jopadhola' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Iteso', 'Nilo-Hamites', 22)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikorar', 1 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Irarak', 2 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikatekok', 3 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Igoria', 4 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Inomen', 5 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Inomu', 6 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikarwok', 7 from public.tribes where name = 'Iteso' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Karamojong', 'Nilo-Hamites', 23)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngipian', 1 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngibokora', 2 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngimatheniko', 3 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngijie', 4 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngidodoth', 5 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ngikwatela', 6 from public.tribes where name = 'Karamojong' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Sebei / Sabiny', 'Nilo-Hamites', 24)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kamkett', 1 from public.tribes where name = 'Sebei / Sabiny' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kapsirika', 2 from public.tribes where name = 'Sebei / Sabiny' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Cheptai', 3 from public.tribes where name = 'Sebei / Sabiny' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kapworop', 4 from public.tribes where name = 'Sebei / Sabiny' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kabeywa', 5 from public.tribes where name = 'Sebei / Sabiny' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Kumam', 'Nilo-Hamites', 25)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikokor', 1 from public.tribes where name = 'Kumam' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikariwok', 2 from public.tribes where name = 'Kumam' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Inam', 3 from public.tribes where name = 'Kumam' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Pokot', 'Nilo-Hamites', 26)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Karapoy', 1 from public.tribes where name = 'Pokot' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Chemoroko', 2 from public.tribes where name = 'Pokot' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lopet', 3 from public.tribes where name = 'Pokot' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Ik (Teuso)', 'Nilo-Hamites', 27)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kamiya', 1 from public.tribes where name = 'Ik (Teuso)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Lorika', 2 from public.tribes where name = 'Ik (Teuso)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ikuet', 3 from public.tribes where name = 'Ik (Teuso)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Tepeth', 'Nilo-Hamites', 28)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Kadam', 1 from public.tribes where name = 'Tepeth' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Moroto', 2 from public.tribes where name = 'Tepeth' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Napak', 3 from public.tribes where name = 'Tepeth' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Lugbara', 'Central Sudanic', 29)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ayivu', 1 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Maracha', 2 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Terego', 3 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Vurra', 4 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Aringa', 5 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Rigbo', 6 from public.tribes where name = 'Lugbara' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Madi', 'Central Sudanic', 30)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Moyo', 1 from public.tribes where name = 'Madi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Adjumani', 2 from public.tribes where name = 'Madi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Pakele', 3 from public.tribes where name = 'Madi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Odugbe', 4 from public.tribes where name = 'Madi' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Kakwa', 'Central Sudanic', 31)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Koboko', 1 from public.tribes where name = 'Kakwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Yumbe', 2 from public.tribes where name = 'Kakwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Nyangilia', 3 from public.tribes where name = 'Kakwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Ludara', 4 from public.tribes where name = 'Kakwa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Kebu (Okebu)', 'Central Sudanic', 32)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Avuya', 1 from public.tribes where name = 'Kebu (Okebu)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Okapi', 2 from public.tribes where name = 'Kebu (Okebu)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Membi', 3 from public.tribes where name = 'Kebu (Okebu)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Didi', 4 from public.tribes where name = 'Kebu (Okebu)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Odru', 5 from public.tribes where name = 'Kebu (Okebu)' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Lendu', 'Central Sudanic', 33)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Avuya', 1 from public.tribes where name = 'Lendu' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Okapi', 2 from public.tribes where name = 'Lendu' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Membi', 3 from public.tribes where name = 'Lendu' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Didi', 4 from public.tribes where name = 'Lendu' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Odru', 5 from public.tribes where name = 'Lendu' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

insert into public.tribes (name, ethnic_group, display_order) values ('Aringa', 'Central Sudanic', 34)
  on conflict (name) do update set ethnic_group = excluded.ethnic_group, display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Avuya', 1 from public.tribes where name = 'Aringa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Okapi', 2 from public.tribes where name = 'Aringa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Membi', 3 from public.tribes where name = 'Aringa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Didi', 4 from public.tribes where name = 'Aringa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;
insert into public.clans (tribe_id, name, display_order) select id, 'Odru', 5 from public.tribes where name = 'Aringa' on conflict (tribe_id, name) do update set display_order = excluded.display_order;

