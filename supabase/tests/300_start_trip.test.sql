begin;
select plan(10);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'a_pm', id::text from public.trips
  where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips
  where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

-- HELPER_A starts A_PM
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.start_trip((select v::uuid from ids where k = 'a_pm'),
                     '10000000-0000-0000-0000-000000000001', now()))->>'status',
  'roll_call', 'A_PM starts in roll_call');
select is(
  (public.start_trip((select v::uuid from ids where k = 'a_pm'),
                     '10000000-0000-0000-0000-000000000001', now()))->>'status',
  'roll_call', 'replaying the same client_action_id returns the same result');
select throws_ok(
  $$ select public.start_trip((select v::uuid from ids where k = 'a_pm'),
                              '10000000-0000-0000-0000-000000000002', now()) $$,
  'P0001', 'INVALID_STATE', 'a new action id on a started trip is INVALID_STATE');
select tests.clear_authentication();

select isnt((select started_at from public.trips where id = (select v::uuid from ids where k = 'a_pm')),
            null, 'started_at is set');
select is((select count(*)::int from public.trip_events
           where trip_id = (select v::uuid from ids where k = 'a_pm') and type = 'trip_started'),
          1, 'exactly one trip_started event, even after the replay');

-- the morning trip goes straight to in_progress
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.start_trip((select v::uuid from ids where k = 'a_am'),
                     '10000000-0000-0000-0000-000000000003', now()))->>'status',
  'in_progress', 'A_AM starts in_progress');
select tests.clear_authentication();

-- not the trip helper
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.start_trip((select v::uuid from ids where k = 'a_pm'),
                              '10000000-0000-0000-0000-000000000004', now()) $$,
  'P0001', 'NOT_AUTHORIZED', 'helper B cannot start a school-A trip');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.start_trip((select v::uuid from ids where k = 'a_pm'),
                              '10000000-0000-0000-0000-000000000005', now()) $$,
  'P0001', 'NOT_AUTHORIZED', 'a parent cannot start a trip');
select tests.clear_authentication();

-- unknown trip
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.start_trip(gen_random_uuid(), '10000000-0000-0000-0000-000000000006', now()) $$,
  'P0001', 'NOT_FOUND', 'unknown trip');
select tests.clear_authentication();

-- an action id used by one user cannot be replayed by another
select tests.authenticate_as('a0000000-0000-0000-0000-000000000006');
select throws_ok(
  $$ select public.start_trip((select v::uuid from ids where k = 'a_pm'),
                              '10000000-0000-0000-0000-000000000001', now()) $$,
  'P0001', 'NOT_AUTHORIZED', 'someone else cannot replay another user action id');
select tests.clear_authentication();

select * from finish();
rollback;
