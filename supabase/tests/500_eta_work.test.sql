begin;
select plan(8);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_pm');
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'a_pm')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003',
                     'f0000000-0000-0000-0000-000000000004');
insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at)
values ((select v::uuid from ids where k = 'a_pm'), '11111111-1111-1111-1111-111111111111',
        private.make_point(25.1, 55.2), 25.1, 55.2, now());

select is(jsonb_array_length(public.get_eta_work()), 1, 'one trip needs ETAs');
select is((select array_agg(s->>'stop_id' order by (s->>'sequence')::int)
           from jsonb_array_elements(public.get_eta_work()->0->'stops') s),
          array['d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
                'd0000000-0000-0000-0000-000000000003'],
          'stops are STOP_A1, A2, A3 in sequence order');
select is(public.get_eta_work()->0->'origin'->>'lat', '25.1', 'the origin is the bus position');
select is(public.get_eta_work()->0->>'eta_alert_minutes', '10', 'the alert minutes come from the school');

-- STUDENT_1 already alerted: STOP_A1 disappears
update public.trip_students set eta_alert_sent_at = now()
where trip_id = (select v::uuid from ids where k = 'a_pm') and student_id = 'f0000000-0000-0000-0000-000000000001';
select is(jsonb_array_length(public.get_eta_work()->0->'stops'), 2, 'STOP_A1 is gone once its students were alerted');

-- a stale position hides the trip
update public.bus_positions set recorded_at = now() - interval '5 minutes';
select is(jsonb_array_length(public.get_eta_work()), 0, 'a position older than 2 minutes means no work');
update public.bus_positions set recorded_at = now();

-- morning trip: expected students are the ones waiting
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_am');
update public.trip_students set status = 'dropped' where trip_id = (select v::uuid from ids where k = 'a_am')
  and student_id <> 'f0000000-0000-0000-0000-000000000003';
insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at)
values ((select v::uuid from ids where k = 'a_am'), '11111111-1111-1111-1111-111111111111',
        private.make_point(25.06, 55.23), 25.06, 55.23, now());
select is((select s->>'stop_id' from jsonb_array_elements(
             (select e->'stops' from jsonb_array_elements(public.get_eta_work()) e
              where e->>'trip_id' = (select v from ids where k = 'a_am'))) s limit 1),
          'd0000000-0000-0000-0000-000000000002', 'the morning trip lists STOP_A2 for STUDENT_3');

-- authenticated callers are refused
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.get_eta_work() $$, '42501', null, 'authenticated users cannot call get_eta_work');
select tests.clear_authentication();

select * from finish();
rollback;
