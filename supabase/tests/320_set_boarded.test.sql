begin;
select plan(12);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'a_pm', id::text from public.trips
  where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips
  where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

-- Boarding while the trip is still scheduled
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.set_boarded((select v::uuid from ids where k = 'a_pm'),
       'f0000000-0000-0000-0000-000000000001', true, '20000000-0000-0000-0000-000000000001', now()) $$,
  'P0001', 'INVALID_STATE', 'cannot board on a scheduled trip');
select tests.clear_authentication();

update public.trips set status = 'roll_call' where id = (select v::uuid from ids where k = 'a_pm');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.set_boarded((select v::uuid from ids where k = 'a_pm'),
     'f0000000-0000-0000-0000-000000000001', true, '20000000-0000-0000-0000-000000000002', now()))->>'status',
  'boarded', 'STUDENT_1 boarded on A_PM');
select tests.clear_authentication();

select is((select count(*)::int from public.trip_events
           where trip_id = (select v::uuid from ids where k = 'a_pm') and type = 'student_boarded'),
          1, 'a student_boarded event was logged');
select ok((select send_after > now() from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000001' and type = 'boarded'),
          'a boarded notification is queued with a hold');

-- un-board during roll_call
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.set_boarded((select v::uuid from ids where k = 'a_pm'),
     'f0000000-0000-0000-0000-000000000001', false, '20000000-0000-0000-0000-000000000003', now()))->>'status',
  'expected', 'un-board in roll_call returns to expected');
select tests.clear_authentication();
select is((select status::text from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000001' and type = 'boarded'),
          'cancelled', 'the queued notification is cancelled');

-- board again revives it
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.set_boarded((select v::uuid from ids where k = 'a_pm'),
  'f0000000-0000-0000-0000-000000000001', true, '20000000-0000-0000-0000-000000000004', now());
select tests.clear_authentication();
select is((select status::text from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000001' and type = 'boarded'),
          'pending', 'boarding again revives the notification');

-- un-board once roll call is confirmed (in_progress) -> missing
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_pm');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.set_boarded((select v::uuid from ids where k = 'a_pm'),
     'f0000000-0000-0000-0000-000000000001', false, '20000000-0000-0000-0000-000000000005', now()))->>'status',
  'missing', 'un-board in in_progress goes to missing');

-- boarding a dropped student
select tests.clear_authentication();
update public.trip_students set status = 'dropped'
where trip_id = (select v::uuid from ids where k = 'a_pm') and student_id = 'f0000000-0000-0000-0000-000000000002';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.set_boarded((select v::uuid from ids where k = 'a_pm'),
       'f0000000-0000-0000-0000-000000000002', true, '20000000-0000-0000-0000-000000000006', now()) $$,
  'P0001', 'INVALID_STATE', 'cannot board a dropped student');
select tests.clear_authentication();

-- an absent_reported student can still board
update public.trip_students set status = 'absent_reported'
where trip_id = (select v::uuid from ids where k = 'a_pm') and student_id = 'f0000000-0000-0000-0000-000000000003';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.set_boarded((select v::uuid from ids where k = 'a_pm'),
     'f0000000-0000-0000-0000-000000000003', true, '20000000-0000-0000-0000-000000000007', now()))->>'status',
  'boarded', 'an absent_reported student can board');
select tests.clear_authentication();

-- morning trip: picked_up notification
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_am');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.set_boarded((select v::uuid from ids where k = 'a_am'),
  'f0000000-0000-0000-0000-000000000003', true, '20000000-0000-0000-0000-000000000008', now());
select tests.clear_authentication();
select is((select type::text from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000003'
             and trip_id = (select v::uuid from ids where k = 'a_am')),
          'picked_up', 'morning boarding queues picked_up');

-- replay returns the same result without a second event
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.set_boarded((select v::uuid from ids where k = 'a_am'),
     'f0000000-0000-0000-0000-000000000003', true, '20000000-0000-0000-0000-000000000008', now()))->>'status',
  'boarded', 'replaying the same action id returns the first result');
select tests.clear_authentication();

select * from finish();
rollback;
