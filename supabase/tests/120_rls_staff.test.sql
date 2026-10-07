begin;
select plan(13);

-- ADMIN_A
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.students), 5, 'admin A sees 5 students');
select is((select count(*)::int from public.students where school_id = '22222222-2222-2222-2222-222222222222'),
          0, 'admin A sees no school-B students');
select is((select count(*)::int from public.guardian_links), 6, 'admin A sees all school-A guardian links');
select lives_ok(
  $$ insert into public.buses (school_id, label_ar, label_en)
     values ('11111111-1111-1111-1111-111111111111', 'حافلة 99', 'Bus 99') $$,
  'admin A can insert a bus in school A');
select throws_ok(
  $$ insert into public.buses (school_id, label_ar, label_en)
     values ('22222222-2222-2222-2222-222222222222', 'حافلة 98', 'Bus 98') $$,
  '42501', null, 'admin A cannot insert a bus in school B');
select is((select count(*)::int from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'),
          1, 'admin A can read the profile of PARENT_1');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-000000000003'),
          0, 'admin A cannot read the profile of PARENT_B');
select tests.clear_authentication();

-- HELPER_A (no trips exist yet)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.students), 0, 'helper A sees no students before trips exist');
select is((select count(*)::int from public.stops where school_id = '11111111-1111-1111-1111-111111111111'),
          4, 'helper A sees the 4 school-A stops through their default routes');
select throws_ok(
  $$ insert into public.students (school_id, name_ar, name_en)
     values ('11111111-1111-1111-1111-111111111111', 'x', 'x') $$,
  '42501', null, 'helper A cannot insert a student');
select is((select count(*)::int from public.memberships), 1, 'helper A sees their own membership');
select tests.clear_authentication();

-- ADMIN_B
select tests.authenticate_as('b0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.students), 1, 'admin B sees 1 student');
select is((select count(*)::int from public.buses where school_id = '11111111-1111-1111-1111-111111111111'),
          0, 'admin B sees no school-A buses');
select tests.clear_authentication();

select * from finish();
rollback;
