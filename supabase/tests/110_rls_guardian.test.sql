begin;
select plan(14);

-- PARENT_1: approved guardian of STUDENT_1 and STUDENT_2
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.students), 2, 'parent 1 sees exactly their 2 children');
select is((select count(*)::int from public.students
           where id = 'f0000000-0000-0000-0000-000000000003'), 0, 'parent 1 cannot see STUDENT_3');
select is((select array_agg(id) from public.schools), array['11111111-1111-1111-1111-111111111111'::uuid],
          'parent 1 sees exactly school A');
select is((select count(*)::int from public.guardian_links), 2, 'parent 1 sees only their own 2 guardian links');
select is((select array_agg(id order by id) from public.stops
           where id in ('d0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001')),
          array['d0000000-0000-0000-0000-000000000000'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid],
          'parent 1 sees STOP_A1 and STOP_A_SCHOOL');
select is((select count(*)::int from public.stops
           where id in ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003')),
          0, 'parent 1 does not see STOP_A2 or STOP_A3');
select is((select count(*)::int from public.memberships), 0, 'parent 1 sees no memberships');
select is((select count(*)::int from public.trip_events)
        + (select count(*)::int from public.location_pings)
        + (select count(*)::int from public.alerts), 0, 'parent 1 sees no trip_events, location_pings or alerts');
select throws_ok(
  $$ insert into public.students (school_id, name_ar, name_en)
     values ('11111111-1111-1111-1111-111111111111', 'x', 'x') $$,
  '42501', null, 'parent 1 cannot insert a student');
select tests.clear_authentication();

-- PARENT_3: pending link only
select tests.authenticate_as('a0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.students), 0, 'parent 3 (pending) sees no students');
select is((select count(*)::int from public.schools), 0, 'parent 3 (pending) sees no schools');
select tests.clear_authentication();

-- PARENT_B: school B
select tests.authenticate_as('b0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.students), 1, 'parent B sees 1 student');
select is((select id from public.students), 'f0000000-0000-0000-0000-0000000000b1'::uuid, 'parent B sees STUDENT_B1');
select is((select count(*)::int from public.students where school_id = '11111111-1111-1111-1111-111111111111'),
          0, 'parent B sees no school-A students');
select tests.clear_authentication();

select * from finish();
rollback;
