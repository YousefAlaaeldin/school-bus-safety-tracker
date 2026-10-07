begin;
select plan(13);

-- dates: 07 forced end (A_PM), 08 returned-to-school flow (A_PM), 09 morning (A_AM)
select public.generate_trips('2030-01-07');
select public.generate_trips('2030-01-08');
select public.generate_trips('2030-01-09');

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'pm07', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'pm08', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-08';
insert into ids select 'am09', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-09';

-- ending a scheduled trip
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.end_trip((select v::uuid from ids where k = 'pm07'), false, null, gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'cannot end a scheduled trip');
select tests.clear_authentication();

update public.trips set status = 'in_progress' where id in (select v::uuid from ids);
update public.trip_students set status = 'boarded'
where trip_id in (select v::uuid from ids where k in ('pm07', 'pm08'))
  and student_id = 'f0000000-0000-0000-0000-000000000001';

-- 07: forced end
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.end_trip((select v::uuid from ids where k = 'pm07'), false, null, gen_random_uuid(), now()) $$,
  'P0001', 'STUDENTS_ON_BOARD', 'cannot end with a child on board');
select throws_ok(
  $$ select public.end_trip((select v::uuid from ids where k = 'pm07'), true, '', gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_INPUT', 'a forced end needs a reason');
select is(
  (public.end_trip((select v::uuid from ids where k = 'pm07'), true, 'Breakdown', gen_random_uuid(), now()))->>'status',
  'completed', 'a forced end completes the trip');
select tests.clear_authentication();
select is((select end_forced from public.trips where id = (select v::uuid from ids where k = 'pm07')),
          true, 'end_forced is true');
select is((select severity::text from public.alerts
           where trip_id = (select v::uuid from ids where k = 'pm07') and type = 'trip_forced_end'),
          'critical', 'a critical alert is raised');
select is((select (params->>'count') from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm07') and type = 'trip_forced_end'),
          '1', 'admins are told how many children were on board');

-- 08: return the child to school, then end normally
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.mark_returned_to_school((select v::uuid from ids where k = 'pm08'), 'f0000000-0000-0000-0000-000000000001',
     gen_random_uuid(), now()))->>'status',
  'returned_to_school', 'STUDENT_1 returned to school');
select is(
  (public.end_trip((select v::uuid from ids where k = 'pm08'), false, null, gen_random_uuid(), now()))->>'forced',
  'false', 'a normal end is not forced');
select tests.clear_authentication();
select is((select count(*)::int from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm08') and type = 'returned_to_school'),
          1, 'the guardian is told the child is returning');
select is((select severity::text from public.alerts
           where trip_id = (select v::uuid from ids where k = 'pm08') and type = 'student_returned'),
          'warning', 'a warning alert is raised');

-- 09: morning trip, one child boards, arrives, then the trip ends
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'am09') and student_id = 'f0000000-0000-0000-0000-000000000001';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.arrive_at_school((select v::uuid from ids where k = 'am09'), gen_random_uuid(), now());
select public.end_trip((select v::uuid from ids where k = 'am09'), false, null, gen_random_uuid(), now());
select tests.clear_authentication();
select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'am09') and status = 'missing'),
          4, 'the four children never picked up are missing');
select is((select count(*)::int from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'am09') and type = 'no_show'),
          3, 'no_show notifications go only to students with approved guardians');

select * from finish();
rollback;
