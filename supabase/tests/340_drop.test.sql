begin;
select plan(11);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

update public.trips set status = 'in_progress' where id in (select v::uuid from ids);
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'a_pm')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');

-- drop exactly at STOP_A1 (25.0935, 55.2105)
select is(
  (public.mark_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000001',
     gen_random_uuid(), now(), 25.0935, 55.2105))->>'status',
  'dropped', 'STUDENT_1 dropped');
select tests.clear_authentication();
select ok((select drop_distance_m between 0 and 5 from public.trip_students
           where student_id = 'f0000000-0000-0000-0000-000000000001' and trip_id = (select v::uuid from ids where k = 'a_pm')),
          'drop distance at the stop is about 0');
select ok((select send_after > now() from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000001' and type = 'dropped'),
          'a dropped notification is queued with a hold');

-- undo right away
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.undo_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000001',
     gen_random_uuid(), now()))->>'status',
  'boarded', 'undo returns the student to boarded');
select tests.clear_authentication();
select is((select dropped_at is null and dropped_location is null and drop_distance_m is null
           from public.trip_students
           where student_id = 'f0000000-0000-0000-0000-000000000001' and trip_id = (select v::uuid from ids where k = 'a_pm')),
          true, 'dropped_* fields are cleared');
select is((select status::text from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000001' and type = 'dropped'),
          'cancelled', 'the dropped notification is cancelled');

-- a drop about 1 km away
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.mark_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000002',
  gen_random_uuid(), now(), 25.0935 + 0.009, 55.2105);
select tests.clear_authentication();
select ok((select drop_distance_m between 900 and 1100 from public.trip_students
           where student_id = 'f0000000-0000-0000-0000-000000000002' and trip_id = (select v::uuid from ids where k = 'a_pm')),
          'a drop about 1 km away records about 1000 m');

-- undo after the 2 minute window
update public.trip_students set dropped_at = now() - interval '3 minutes'
where student_id = 'f0000000-0000-0000-0000-000000000002' and trip_id = (select v::uuid from ids where k = 'a_pm');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.undo_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000002',
       gen_random_uuid(), now()) $$,
  'P0001', 'UNDO_WINDOW_PASSED', 'cannot undo after 2 minutes');

-- dropping someone who is not on board
select throws_ok(
  $$ select public.mark_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000003',
       gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'cannot drop an expected student');

-- morning trips have no drops
select throws_ok(
  $$ select public.mark_dropped((select v::uuid from ids where k = 'a_am'), 'f0000000-0000-0000-0000-000000000001',
       gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'cannot use mark_dropped on a morning trip');
select tests.clear_authentication();

-- replay safety: the same action id returns the first result and does not change anything again
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.mark_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000009', now(), 25.0935, 55.2105);
select is(
  (public.mark_dropped((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000009', now(), 25.0935, 55.2105))->>'status',
  'dropped', 'replaying a drop returns the first result');
select tests.clear_authentication();

select * from finish();
rollback;
