begin;
select plan(11);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

update public.trips set status = 'in_progress' where id in (select v::uuid from ids);
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'a_pm')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002');

-- 25 minutes away: stored, but no alert yet
select is(
  (public.apply_etas((select v::uuid from ids where k = 'a_pm'),
    jsonb_build_array(jsonb_build_object('stop_id', 'd0000000-0000-0000-0000-000000000001',
      'eta_at', now() + interval '25 minutes', 'source', 'fallback'))))->>'alerted',
  '0', 'no alert at 25 minutes');
select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'a_pm') and eta_at is not null),
          2, 'eta_at is set on both children at STOP_A1');
select is((select count(*)::int from public.notification_outbox where type = 'eta_dropoff'), 0, 'no notification yet');

-- 8 minutes away: both children's guardian is alerted
select is(
  (public.apply_etas((select v::uuid from ids where k = 'a_pm'),
    jsonb_build_array(jsonb_build_object('stop_id', 'd0000000-0000-0000-0000-000000000001',
      'eta_at', now() + interval '8 minutes', 'source', 'routes_api'))))->>'alerted',
  '2', 'two children alerted at 8 minutes');
select is((select count(*)::int from public.notification_outbox
           where type = 'eta_dropoff' and recipient_user_id = 'a0000000-0000-0000-0000-000000000003'),
          2, 'PARENT_1 gets one notification per child');
select is((select distinct params->>'minutes' from public.notification_outbox where type = 'eta_dropoff'),
          '8', 'the notification says 8 minutes');
select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'a_pm') and eta_alert_sent_at is not null),
          2, 'eta_alert_sent_at is set');

-- fires only once, but the ETA keeps updating
select is(
  (public.apply_etas((select v::uuid from ids where k = 'a_pm'),
    jsonb_build_array(jsonb_build_object('stop_id', 'd0000000-0000-0000-0000-000000000001',
      'eta_at', now() + interval '5 minutes', 'source', 'routes_api'))))->>'alerted',
  '0', 'the alert does not fire twice');
select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'a_pm')
             and eta_at = now() + interval '5 minutes'),
          2, 'eta_at still updates');

-- morning trip: eta_pickup, and an ETA in the past says 1 minute
update public.trip_students set status = 'dropped'
where trip_id = (select v::uuid from ids where k = 'a_am') and student_id <> 'f0000000-0000-0000-0000-000000000003';
select public.apply_etas((select v::uuid from ids where k = 'a_am'),
  jsonb_build_array(jsonb_build_object('stop_id', 'd0000000-0000-0000-0000-000000000002',
    'eta_at', now() - interval '1 minute', 'source', 'fallback')));
select is((select params->>'minutes' from public.notification_outbox
           where type = 'eta_pickup' and student_id = 'f0000000-0000-0000-0000-000000000003'),
          '1', 'a morning ETA in the past is clamped to 1 minute (eta_pickup)');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.apply_etas(gen_random_uuid(), '[]'::jsonb) $$, '42501', null,
                 'authenticated users cannot call apply_etas');
select tests.clear_authentication();

select * from finish();
rollback;
