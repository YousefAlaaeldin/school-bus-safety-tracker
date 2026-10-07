begin;
select plan(5);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

update public.schools set location_retention_days = 30 where id = '11111111-1111-1111-1111-111111111111';

insert into public.location_pings (trip_id, location, recorded_at) values
  ((select v::uuid from ids where k = 'a_pm'), private.make_point(25.1, 55.2), now() - interval '31 days'),
  ((select v::uuid from ids where k = 'a_pm'), private.make_point(25.1, 55.2), now() - interval '29 days');

-- a completed trip finished 2 days ago, and an active one
update public.trips set status = 'completed', ended_at = now() - interval '2 days'
where id = (select v::uuid from ids where k = 'a_am');
update public.trips set status = 'in_progress' where id = (select v::uuid from ids where k = 'a_pm');
insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at) values
  ((select v::uuid from ids where k = 'a_am'), '11111111-1111-1111-1111-111111111111', private.make_point(25.1, 55.2), 25.1, 55.2, now() - interval '2 days'),
  ((select v::uuid from ids where k = 'a_pm'), '11111111-1111-1111-1111-111111111111', private.make_point(25.1, 55.2), 25.1, 55.2, now());

select is((public.purge_old_location_data())->>'pings_deleted', '1', 'one old ping was deleted');
select is((select count(*)::int from public.location_pings), 1, 'the 29-day-old ping is kept');
select is((select count(*)::int from public.bus_positions where trip_id = (select v::uuid from ids where k = 'a_am')), 0,
          'the position of a trip completed 2 days ago is deleted');
select is((select count(*)::int from public.bus_positions where trip_id = (select v::uuid from ids where k = 'a_pm')), 1,
          'the position of an active trip is kept');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.purge_old_location_data() $$, '42501', null, 'authenticated users cannot purge');
select tests.clear_authentication();

select * from finish();
rollback;
