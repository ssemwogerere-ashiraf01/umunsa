-- 027: Academic structure (campus, faculty, programme) + profile fields
-- No dollar-quotes that get corrupted by some SQL clients.

-- Reference tables
create table if not exists public.campuses (
  id serial primary key,
  name text not null unique,
  display_order int not null default 0
);

create table if not exists public.faculties (
  id serial primary key,
  name text not null unique,
  display_order int not null default 0
);

create table if not exists public.programmes (
  id serial primary key,
  faculty_id int not null references public.faculties(id) on delete cascade,
  name text not null,
  level text,
  unique (faculty_id, name)
);

create index if not exists idx_programmes_faculty on public.programmes(faculty_id);

-- Profile columns
alter table public.profiles add column if not exists campus text;
alter table public.profiles add column if not exists academic_year text;
alter table public.profiles add column if not exists semester integer;

comment on column public.profiles.campus is 'UMU campus e.g. Main Campus Nkozi';
comment on column public.profiles.academic_year is 'e.g. 2025/2026';
comment on column public.profiles.semester is '1 or 2';

-- RLS: public read of reference data
alter table public.campuses enable row level security;
alter table public.faculties enable row level security;
alter table public.programmes enable row level security;

drop policy if exists campuses_read on public.campuses;
create policy campuses_read on public.campuses for select to anon, authenticated using (true);

drop policy if exists faculties_read on public.faculties;
create policy faculties_read on public.faculties for select to anon, authenticated using (true);

drop policy if exists programmes_read on public.programmes;
create policy programmes_read on public.programmes for select to anon, authenticated using (true);

-- Seed campuses
insert into public.campuses (name, display_order) values
  ('Main Campus Nkozi', 1),
  ('Lubaga Campus', 2),
  ('Nsambya Campus', 3),
  ('Fort Portal Campus', 4),
  ('Masaka Campus', 5),
  ('Mbale Campus', 6),
  ('Ngetta Campus', 7),
  ('Other', 99)
on conflict (name) do nothing;

-- Seed faculties
insert into public.faculties (name, display_order) values
  ('Faculty of Agriculture', 1),
  ('Faculty of Business Administration and Management', 2),
  ('Faculty of Education', 3),
  ('Faculty of Science', 4),
  ('Faculty of Law', 5),
  ('Faculty of the Built Environment', 6),
  ('Faculty of Health Sciences', 7),
  ('Faculty of Engineering and Applied Sciences', 8),
  ('School of Arts and Social Sciences', 9),
  ('Mother Kevin Postgraduate Medical School', 10),
  ('Directorate of Graduate Studies, Research and Enterprise', 11),
  ('Institute of Ethics', 12),
  ('Institute of Languages and Communication Studies', 13),
  ('Other', 99)
on conflict (name) do nothing;

-- Helper: insert programme by faculty name
-- Agriculture
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Agriculture', 'bachelor'),
  ('Bachelor of Science in Agriculture', 'bachelor'),
  ('Bachelor of Science in Ecological Organic Agriculture', 'bachelor'),
  ('Bachelor of Agricultural Economics and Agribusiness Management', 'bachelor'),
  ('Bachelor of Science in Agricultural Technology', 'bachelor'),
  ('Diploma in Animal Production and Farm Management', 'diploma'),
  ('Diploma in Crop Production and Farm Management', 'diploma'),
  ('Diploma in Agricultural Economics and Agribusiness Management', 'diploma'),
  ('Certificate in Agriculture', 'certificate'),
  ('Master of Science in Agro-Ecology', 'masters'),
  ('Master of Science in Monitoring and Evaluation', 'masters'),
  ('Master of Science in Agribusiness Innovations', 'masters'),
  ('Doctor of Philosophy in Agro-ecology and Food Systems', 'phd')
) as p(name, level)
where f.name = 'Faculty of Agriculture'
on conflict (faculty_id, name) do nothing;

-- Business
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Business Administration and Management', 'bachelor'),
  ('Bachelor of Procurement and Supply Chain Management', 'bachelor'),
  ('Bachelor of International Business Management', 'bachelor'),
  ('Bachelor of Science in Accounting and Finance', 'bachelor'),
  ('Bachelor of Arts in Microfinance and Community Economic Development', 'bachelor'),
  ('Bachelor of Science in Economics and Natural Resources Management', 'bachelor'),
  ('Bachelor of Real Estate Management', 'bachelor'),
  ('Diploma in Business Administration and Management', 'diploma'),
  ('Master of Business Administration', 'masters'),
  ('F4Impact Master of Business Administration', 'masters'),
  ('Master of Arts in Microfinance and Management', 'masters'),
  ('Master of Science in Development Economics', 'masters')
) as p(name, level)
where f.name = 'Faculty of Business Administration and Management'
on conflict (faculty_id, name) do nothing;

-- Education
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Arts with Education', 'bachelor'),
  ('Bachelor of Science with Education', 'bachelor'),
  ('Bachelor of Science with Education - Agriculture', 'bachelor'),
  ('Bachelor of Inclusive Deaf Education (Arts and Sciences)', 'bachelor'),
  ('Bachelor of Education (Primary)', 'bachelor'),
  ('Bachelor of Education (Early Childhood Development)', 'bachelor'),
  ('Diploma in Education (Primary)', 'diploma'),
  ('Diploma in Early Childhood Development Education', 'diploma'),
  ('Higher Education Access Certificate', 'certificate'),
  ('Certificate in Sign Language and Deaf Culture', 'certificate'),
  ('Master of Education', 'masters'),
  ('Masters in Higher Education (Innovation Pedagogy and Leadership)', 'masters'),
  ('Postgraduate Diploma in Education', 'pgd'),
  ('Postgraduate Diploma in Innovative Teaching and Learning in Higher Education', 'pgd')
) as p(name, level)
where f.name = 'Faculty of Education'
on conflict (faculty_id, name) do nothing;

-- Science
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Science in Computer Science', 'bachelor'),
  ('Bachelor of Science in Information Technology', 'bachelor'),
  ('Bachelor of Science in Economics and Statistics', 'bachelor'),
  ('Bachelor of Science General', 'bachelor'),
  ('Diploma in Information Technology', 'diploma'),
  ('Diploma in Science Laboratory Technology', 'diploma'),
  ('Certificate in Data Analytics and Management', 'certificate'),
  ('Certificate in Computer Applications', 'certificate'),
  ('Certificate in Laboratory Technology', 'certificate'),
  ('Master of Science in Information Systems', 'masters'),
  ('Master of Science in ICT Architectural Design and Management', 'masters'),
  ('Master of Science in Computer Forensics', 'masters'),
  ('Doctor of Philosophy in Information Systems', 'phd')
) as p(name, level)
where f.name = 'Faculty of Science'
on conflict (faculty_id, name) do nothing;

-- Law
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Laws', 'bachelor'),
  ('Certificate in Administrative Law', 'certificate')
) as p(name, level)
where f.name = 'Faculty of Law'
on conflict (faculty_id, name) do nothing;

-- Built Environment
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Environmental Design', 'bachelor'),
  ('Master of Architecture (Professional)', 'masters')
) as p(name, level)
where f.name = 'Faculty of the Built Environment'
on conflict (faculty_id, name) do nothing;

-- Health Sciences
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Science in Public Health', 'bachelor'),
  ('Bachelor of Science in Health Promotion and Education', 'bachelor'),
  ('Bachelor of Science in Counselling Psychology', 'bachelor'),
  ('Diploma in Counselling Psychology', 'diploma'),
  ('Certificate in Medical Records and Informatics Management', 'certificate'),
  ('Certificate in Health Promotion and Education', 'certificate'),
  ('Certificate in Child and Adolescent Counselling', 'certificate'),
  ('Certificate in HIV/AIDS Counselling', 'certificate'),
  ('Master of Science in Clinical Epidemiology and Biostatistics', 'masters'),
  ('Master of Public Health in Health Promotion', 'masters'),
  ('Master of Public Health in Population and Reproductive Health', 'masters'),
  ('Master of Science in Health Services Management', 'masters'),
  ('Master of Science in Counselling Psychology', 'masters'),
  ('Postgraduate Diploma in Health Service Management', 'pgd'),
  ('Postgraduate Diploma in Health Promotion and Education', 'pgd')
) as p(name, level)
where f.name = 'Faculty of Health Sciences'
on conflict (faculty_id, name) do nothing;

-- Engineering
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Science in Civil Engineering', 'bachelor'),
  ('Bachelor of Science in Electrical Engineering', 'bachelor'),
  ('Bachelor of Science in Mechanical and Manufacturing Engineering', 'bachelor'),
  ('Diploma in Civil Engineering', 'diploma'),
  ('Diploma in Electrical Engineering', 'diploma'),
  ('Diploma in Mechanical and Manufacturing Engineering', 'diploma'),
  ('Diploma in Water Engineering', 'diploma')
) as p(name, level)
where f.name = 'Faculty of Engineering and Applied Sciences'
on conflict (faculty_id, name) do nothing;

-- Arts & Social Sciences
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Bachelor of Journalism and Mass Communication', 'bachelor'),
  ('Bachelor of Social Work', 'bachelor'),
  ('Bachelor of Arts in Fashion and Textile Design', 'bachelor'),
  ('Bachelor of Arts in Public Administration and Management', 'bachelor'),
  ('Bachelor of Social Development and Counselling', 'bachelor'),
  ('Master of Arts in Development Studies', 'masters'),
  ('Master of Arts in Human Rights', 'masters'),
  ('Master of Mental Health Counselling Psychology', 'masters'),
  ('Master of Arts in Religious Studies', 'masters'),
  ('Postgraduate Diploma in Counselling Psychology', 'pgd')
) as p(name, level)
where f.name = 'School of Arts and Social Sciences'
on conflict (faculty_id, name) do nothing;

-- Mother Kevin Medical
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Master of Medicine in Internal Medicine', 'masters'),
  ('Master of Medicine in Obstetrics and Gynaecology', 'masters'),
  ('Master of Medicine in Pediatrics and Child Health', 'masters'),
  ('Master of Medicine in General Surgery', 'masters'),
  ('Master of Medicine in Emergency Medicine', 'masters'),
  ('Master of Medicine in Radiology and Imaging', 'masters'),
  ('Master of Medicine in Orthopedic Surgery', 'masters')
) as p(name, level)
where f.name = 'Mother Kevin Postgraduate Medical School'
on conflict (faculty_id, name) do nothing;

-- Graduate Directorate (generic PhDs)
insert into public.programmes (faculty_id, name, level)
select f.id, p.name, p.level from public.faculties f
cross join (values
  ('Doctor of Philosophy by Research', 'phd'),
  ('Doctor of Philosophy in Agro-ecology and Food Systems', 'phd'),
  ('Doctor of Philosophy in Information Systems', 'phd')
) as p(name, level)
where f.name = 'Directorate of Graduate Studies, Research and Enterprise'
on conflict (faculty_id, name) do nothing;

-- Other catch-all
insert into public.programmes (faculty_id, name, level)
select f.id, 'Other (specify in profile notes)', 'other'
from public.faculties f where f.name = 'Other'
on conflict (faculty_id, name) do nothing;
