begin;
select plan(13);

-- three service dates: 07 (main), 08 (notify on), 09 (everyone boarded)
select public.generate_trips('2030-01-07');
select public.generate_trips('2030-01-08');
select public.generate_trips('2030-01-09');

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'pm07', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'am07', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';
insert into ids select 'pm08', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-08';
insert into ids select 'pm09', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-09';

update public.trips set status = 'roll_call' where id in (select v::uuid from ids where k in ('pm07', 'pm08', 'pm09'));
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'am07');

-- 07: STUDENT_1/2/3 boarded, notify_parent_on_missing = false
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'pm07')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.confirm_roll_call((select v::uuid from ids where k = 'pm07'), gen_random_uuid(), now()))->>'missing',
  '2', 'two students are missing');
select throws_ok(
  $$ select public.confirm_roll_call((select v::uuid from ids where k = 'pm07'), gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'confirming twice is INVALID_STATE');
select throws_ok(
  $$ select public.confirm_roll_call((select v::uuid from ids where k = 'am07'), gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'a morning trip has no roll call');
select tests.clear_authentication();

select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'pm07') and status = 'missing'
             and student_id in ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000005')),
          2, 'STUDENT_4 and STUDENT_5 are missing');
select is((select status::text from public.trips where id = (select v::uuid from ids where k = 'pm07')),
          'in_progress', 'the trip is in_progress');
select is((select count(*)::int from public.alerts
           where trip_id = (select v::uuid from ids where k = 'pm07') and type = 'roll_call_missing'),
          1, 'one roll_call_missing alert');
select is((select (params->>'count') || '|' || (params->>'names_en' like '%Yousef Khalid%')::text
           from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm07') and type = 'roll_call_missing'),
          '2|true', 'one admin notification with the count and names');
select is((select count(*)::int from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm07') and type = 'missing_child'),
          0, 'no parent notification when notify_parent_on_missing is false');

-- 08: notify_parent_on_missing = true, only STUDENT_5 is missing
update public.schools set notify_parent_on_missing = true where id = '11111111-1111-1111-1111-111111111111';
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'pm08')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
                     'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select public.confirm_roll_call((select v::uuid from ids where k = 'pm08'), gen_random_uuid(), now());
select tests.clear_authentication();
select is((select count(*)::int from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm08') and type = 'missing_child'),
          1, 'one missing_child notification (STUDENT_5)');
select is((select recipient_user_id from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'pm08') and type = 'missing_child'),
          'a0000000-0000-0000-0000-000000000006'::uuid, 'it goes to HELPER_PARENT');

-- 09: everyone boarded
update public.trip_students set status = 'boarded' where trip_id = (select v::uuid from ids where k = 'pm09');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.confirm_roll_call((select v::uuid from ids where k = 'pm09'), gen_random_uuid(), now()))->>'missing',
  '0', 'nobody missing');
select tests.clear_authentication();
select is((select count(*)::int from public.alerts where trip_id = (select v::uuid from ids where k = 'pm09')),
          0, 'no alert when nobody is missing');

-- a stranger cannot confirm
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.confirm_roll_call((select v::uuid from ids where k = 'pm08'), gen_random_uuid(), now()) $$,
  'P0001', 'NOT_AUTHORIZED', 'a parent cannot confirm roll call');
select tests.clear_authentication();

select * from finish();
rollback;
