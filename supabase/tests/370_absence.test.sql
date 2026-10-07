begin;
select plan(11);

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;

-- PARENT_1 reports before any trips exist, both directions
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is(
  (public.report_absence('f0000000-0000-0000-0000-000000000001', '2030-01-07',
     array['from_school', 'to_school']::public.trip_direction[], 'sick'))->>'created',
  '2', 'two absence rows created');
select tests.clear_authentication();

select tests.make_fixture_trips();
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';
insert into ids select 'abs_pm', id::text from public.absence_reports
  where student_id = 'f0000000-0000-0000-0000-000000000001' and direction = 'from_school';

select is((select count(*)::int from public.trip_students
           where student_id = 'f0000000-0000-0000-0000-000000000001' and status = 'absent_reported'),
          2, 'STUDENT_1 is absent_reported on both A trips');

-- cancel after trips exist
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.cancel_absence((select v::uuid from ids where k = 'abs_pm')) $$,
                'PARENT_1 cancels the afternoon absence');
select tests.clear_authentication();
select is((select status::text from public.trip_students
           where student_id = 'f0000000-0000-0000-0000-000000000001' and trip_id = (select v::uuid from ids where k = 'a_pm')),
          'expected', 'back to expected');

-- trip-based cutoff
update public.trips set scheduled_departure = now() + interval '30 minutes'
where id = (select v::uuid from ids where k = 'a_pm');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.report_absence('f0000000-0000-0000-0000-000000000002', '2030-01-07',
       array['from_school']::public.trip_direction[], null) $$,
  'P0001', 'PAST_CUTOFF', 'a parent cannot report inside the cutoff');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(
  (public.report_absence('f0000000-0000-0000-0000-000000000002', '2030-01-07',
     array['from_school']::public.trip_direction[], null))->>'created',
  '1', 'an admin can report inside the cutoff');
select tests.clear_authentication();

-- past date
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.report_absence('f0000000-0000-0000-0000-000000000001', '2020-01-06',
       array['to_school']::public.trip_direction[], null) $$,
  'P0001', 'PAST_CUTOFF', 'a past date is rejected');

-- empty directions
select throws_ok(
  $$ select public.report_absence('f0000000-0000-0000-0000-000000000001', '2030-01-08',
       array[]::public.trip_direction[], null) $$,
  'P0001', 'INVALID_INPUT', 'at least one direction is required');
select tests.clear_authentication();

-- authorization
select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- PARENT_2
select throws_ok(
  $$ select public.report_absence('f0000000-0000-0000-0000-000000000001', '2030-01-08',
       array['to_school']::public.trip_direction[], null) $$,
  'P0001', 'NOT_AUTHORIZED', 'PARENT_2 cannot report for STUDENT_1');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000005');  -- PARENT_3 (pending)
select throws_ok(
  $$ select public.report_absence('f0000000-0000-0000-0000-000000000004', '2030-01-08',
       array['to_school']::public.trip_direction[], null) $$,
  'P0001', 'NOT_AUTHORIZED', 'a pending guardian cannot report');
select tests.clear_authentication();

select is((select count(*)::int from public.trip_events where type = 'absence_reported'), 1,
          'an absence_reported event is logged only when a trip already exists');

select * from finish();
rollback;
