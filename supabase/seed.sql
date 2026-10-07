-- Seed fixtures (docs/contracts/data-model.md §5). Tests depend on these exact IDs.
-- Local development only. Admin password: password123. Test OTP for every phone: 123456.

-- Schools -------------------------------------------------------------------------------------
insert into public.schools (id, name_ar, name_en, emirate, weekend_days) values
  ('11111111-1111-1111-1111-111111111111', 'مدرسة النور', 'Al Noor School', 'dubai', '{0,6}'),
  ('22222222-2222-2222-2222-222222222222', 'مدرسة الأمل', 'Al Amal School', 'sharjah', '{5,6,0}');

-- Users ---------------------------------------------------------------------------------------
-- The on_auth_user_created trigger creates the profiles.
insert into auth.users (
  id, instance_id, aud, role, email, phone, encrypted_password,
  email_confirmed_at, phone_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  u.email, u.phone,
  case when u.email is not null then extensions.crypt('password123', extensions.gen_salt('bf')) else '' end,
  case when u.email is not null then now() end,
  case when u.phone is not null then now() end,
  now(), now(),
  case when u.email is not null
       then '{"provider":"email","providers":["email"]}'::jsonb
       else '{"provider":"phone","providers":["phone"]}'::jsonb end,
  '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001', 'admin-a@example.com', null),
  ('a0000000-0000-0000-0000-000000000002', null, '971500000002'),
  ('a0000000-0000-0000-0000-000000000003', null, '971500000003'),
  ('a0000000-0000-0000-0000-000000000004', null, '971500000004'),
  ('a0000000-0000-0000-0000-000000000005', null, '971500000005'),
  ('a0000000-0000-0000-0000-000000000006', null, '971500000006'),
  ('b0000000-0000-0000-0000-000000000001', 'admin-b@example.com', null),
  ('b0000000-0000-0000-0000-000000000002', null, '971500000102'),
  ('b0000000-0000-0000-0000-000000000003', null, '971500000103')
) as u(id, email, phone);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), a.id,
  coalesce(a.email, a.phone),
  case when a.email is not null then 'email' else 'phone' end,
  case when a.email is not null
       then jsonb_build_object('sub', a.id::text, 'email', a.email, 'email_verified', true, 'phone_verified', false)
       else jsonb_build_object('sub', a.id::text, 'phone', a.phone, 'email_verified', false, 'phone_verified', true) end,
  now(), now(), now()
from auth.users a
where a.id::text like 'a0000000-%' or a.id::text like 'b0000000-%';

update public.profiles p set display_name = v.name
from (values
  ('a0000000-0000-0000-0000-000000000001', 'Admin A'),
  ('a0000000-0000-0000-0000-000000000002', 'Helper A'),
  ('a0000000-0000-0000-0000-000000000003', 'Parent 1'),
  ('a0000000-0000-0000-0000-000000000004', 'Parent 2'),
  ('a0000000-0000-0000-0000-000000000005', 'Parent 3'),
  ('a0000000-0000-0000-0000-000000000006', 'Helper Parent'),
  ('b0000000-0000-0000-0000-000000000001', 'Admin B'),
  ('b0000000-0000-0000-0000-000000000002', 'Helper B'),
  ('b0000000-0000-0000-0000-000000000003', 'Parent B')
) as v(id, name)
where p.id = v.id::uuid;

-- Memberships ---------------------------------------------------------------------------------
insert into public.memberships (user_id, school_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'helper'),
  ('a0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'helper'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'helper');

-- Buses ---------------------------------------------------------------------------------------
insert into public.buses (id, school_id, label_ar, label_en) values
  ('c0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'حافلة 12', 'Bus 12'),
  ('c0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'حافلة 3', 'Bus 3');

-- Stops ---------------------------------------------------------------------------------------
insert into public.stops (id, school_id, label_ar, label_en, location, is_school)
select s.id::uuid, s.school_id::uuid, s.label_ar, s.label_en,
       extensions.st_setsrid(extensions.st_makepoint(s.lng, s.lat), 4326)::extensions.geography,
       s.is_school
from (values
  ('d0000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'بوابة مدرسة النور', 'Al Noor School gate', 25.1007, 55.1988, true),
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'البرشاء 2، فيلا 14', 'Al Barsha 2, Villa 14', 25.0935, 55.2105, false),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'البرشاء جنوب', 'Al Barsha South', 25.0790, 55.2190, false),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'أرجان، مبنى 7', 'Arjan, Building 7', 25.0585, 55.2300, false),
  ('d0000000-0000-0000-0000-0000000000b0', '22222222-2222-2222-2222-222222222222', 'بوابة مدرسة الأمل', 'Al Amal School gate', 25.3375, 55.4120, true),
  ('d0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'النهدة', 'Al Nahda', 25.3010, 55.3720, false)
) as s(id, school_id, label_ar, label_en, lat, lng, is_school);

-- Routes --------------------------------------------------------------------------------------
insert into public.routes (id, school_id, bus_id, direction, name_ar, name_en, default_helper_id) values
  ('e0000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a1',
   'from_school', 'مسار الظهيرة أ', 'Route A afternoon', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-0000000000a2', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-0000000000a1',
   'to_school', 'مسار الصباح أ', 'Route A morning', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-0000000000b1',
   'from_school', 'مسار الظهيرة ب', 'Route B afternoon', 'b0000000-0000-0000-0000-000000000002');

insert into public.route_schedules (route_id, weekday, departure_time)
select r.route_id::uuid, d, r.departure_time::time
from (values
  ('e0000000-0000-0000-0000-0000000000a1', '14:30', 5),
  ('e0000000-0000-0000-0000-0000000000a2', '06:45', 5),
  ('e0000000-0000-0000-0000-0000000000b1', '13:30', 4)
) as r(route_id, departure_time, last_day),
generate_series(1, 5) as d
where d <= r.last_day;

insert into public.route_stops (route_id, stop_id, sequence) values
  ('e0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000000', 1),
  ('e0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000001', 2),
  ('e0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000002', 3),
  ('e0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000003', 4),
  ('e0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000003', 1),
  ('e0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000002', 2),
  ('e0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000001', 3),
  ('e0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000000', 4),
  ('e0000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-0000000000b0', 1),
  ('e0000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-0000000000b1', 2);

-- Students ------------------------------------------------------------------------------------
insert into public.students (id, school_id, name_ar, name_en) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'سارة أحمد', 'Sara Ahmed'),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'عمر أحمد', 'Omar Ahmed'),
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'لينا سعيد', 'Lina Saeed'),
  ('f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'يوسف خالد', 'Yousef Khalid'),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'مريم علي', 'Mariam Ali'),
  ('f0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'حمد راشد', 'Hamad Rashid');

-- Assignments: each school A student rides both A routes; STUDENT_B1 rides ROUTE_B_PM.
insert into public.student_assignments (student_id, route_id, stop_id, weekdays)
select s.student_id::uuid, r.route_id::uuid, s.stop_id::uuid, '{1,2,3,4,5}'
from (values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002'),
  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003'),
  ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003')
) as s(student_id, stop_id),
(values ('e0000000-0000-0000-0000-0000000000a1'), ('e0000000-0000-0000-0000-0000000000a2')) as r(route_id);

insert into public.student_assignments (student_id, route_id, stop_id, weekdays) values
  ('f0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000b1',
   'd0000000-0000-0000-0000-0000000000b1', '{1,2,3,4}');

-- Guardian links ------------------------------------------------------------------------------
-- A trigger normalises the phone, sets school_id and attaches the profile when one exists.
insert into public.guardian_links (student_id, school_id, guardian_phone, status, approved_by, approved_at)
select l.student_id::uuid, l.school_id::uuid, l.phone, l.status::public.link_status,
       case when l.status = 'approved' then l.approver::uuid end,
       case when l.status = 'approved' then now() end
from (values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '+971500000003', 'approved', 'a0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '+971500000003', 'approved', 'a0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '+971500000004', 'approved', 'a0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '+971500000005', 'pending', null),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '+971500000006', 'approved', 'a0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '+971500000099', 'pending', null),
  ('f0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', '+971500000103', 'approved', 'b0000000-0000-0000-0000-000000000001')
) as l(student_id, school_id, phone, status, approver);

-- Vault secrets used by pg_cron to call Edge Functions.
-- LOCAL DEMO VALUES ONLY (the service-role key below is the public Supabase local-development key).
select vault.create_secret('http://host.docker.internal:54321', 'project_url');
select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key');
