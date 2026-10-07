begin;
select plan(10);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_pm');
update public.trips set status = 'completed' where id = (select v::uuid from ids where k = 'a_am');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');

select is(
  (public.ingest_pings((select v::uuid from ids where k = 'a_pm'), '[
    {"lat": 25.10, "lng": 55.20, "recorded_at": "2030-01-07T10:00:00Z", "speed_mps": 5},
    {"lat": 25.11, "lng": 55.21, "recorded_at": "2030-01-07T10:00:10Z"},
    {"lat": 25.12, "lng": 55.22, "recorded_at": "2030-01-07T10:00:20Z", "heading": 90}
  ]'::jsonb))->>'inserted', '3', 'three new pings are inserted');
select tests.clear_authentication();
select is((select lat from public.bus_positions where trip_id = (select v::uuid from ids where k = 'a_pm')),
          25.12::double precision, 'bus_positions holds the latest ping');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.ingest_pings((select v::uuid from ids where k = 'a_pm'), '[
    {"lat": 25.10, "lng": 55.20, "recorded_at": "2030-01-07T10:00:00Z"},
    {"lat": 25.11, "lng": 55.21, "recorded_at": "2030-01-07T10:00:10Z"},
    {"lat": 25.12, "lng": 55.22, "recorded_at": "2030-01-07T10:00:20Z"}
  ]'::jsonb))->>'inserted', '0', 'the same pings again insert nothing');

-- an older ping later does not move the bus back
select public.ingest_pings((select v::uuid from ids where k = 'a_pm'),
  '[{"lat": 25.00, "lng": 55.00, "recorded_at": "2030-01-07T09:00:00Z"}]'::jsonb);
select tests.clear_authentication();
select is((select lat from public.bus_positions where trip_id = (select v::uuid from ids where k = 'a_pm')),
          25.12::double precision, 'an older ping does not change the position');

-- invalid items are skipped
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.ingest_pings((select v::uuid from ids where k = 'a_pm'), '[
    {"lat": 95, "lng": 55.2, "recorded_at": "2030-01-07T10:01:00Z"},
    {"lat": 25.2, "lng": 55.2},
    {"lat": 25.3, "lng": 55.3, "recorded_at": "2030-01-07T10:01:30Z"}
  ]'::jsonb))->>'inserted', '1', 'invalid items are skipped');

-- too many pings
select throws_ok(
  $$ select public.ingest_pings((select v::uuid from ids where k = 'a_pm'),
       (select jsonb_agg(jsonb_build_object('lat', 25, 'lng', 55, 'recorded_at', now() + (g || ' seconds')::interval))
          from generate_series(1, 501) g)) $$,
  'P0001', 'INVALID_INPUT', '501 pings are rejected');

-- a completed trip returns 0 without error
select is(
  (public.ingest_pings((select v::uuid from ids where k = 'a_am'),
     '[{"lat": 25.1, "lng": 55.2, "recorded_at": "2030-01-07T10:00:00Z"}]'::jsonb))->>'inserted',
  '0', 'a completed trip accepts nothing but does not fail');
select tests.clear_authentication();

-- other helpers
select tests.authenticate_as('b0000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.ingest_pings((select v::uuid from ids where k = 'a_pm'),
       '[{"lat": 25.1, "lng": 55.2, "recorded_at": "2030-01-07T10:00:00Z"}]'::jsonb) $$,
  'P0001', 'NOT_AUTHORIZED', 'helper B cannot upload pings for a school-A trip');
select tests.clear_authentication();

select is((select count(*)::int from public.location_pings where trip_id = (select v::uuid from ids where k = 'a_pm')),
          5, 'five distinct pings were stored in total');
select is((select count(*)::int from public.bus_positions), 1, 'only one bus position exists');

select * from finish();
rollback;
