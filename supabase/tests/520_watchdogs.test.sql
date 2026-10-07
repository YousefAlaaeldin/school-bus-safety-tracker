begin;
select plan(9);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';
insert into ids select 'b_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000b1' and service_date = '2030-01-07';

-- ----- lost contact -----
update public.trips set status = 'in_progress', started_at = now() - interval '10 minutes'
where id = (select v::uuid from ids where k = 'a_pm');
insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at)
values ((select v::uuid from ids where k = 'a_pm'), '11111111-1111-1111-1111-111111111111',
        private.make_point(25.1, 55.2), 25.1, 55.2, now() - interval '6 minutes');

select is((public.run_watchdogs())->>'alerts_created', '1', 'a silent bus raises one alert');
select is((select count(*)::int from public.alerts where type = 'lost_contact'), 1, 'a lost_contact alert exists');
select is((select count(*)::int from public.notification_outbox where type = 'lost_contact'), 1, 'one admin notification');
select is((public.run_watchdogs())->>'alerts_created', '0', 'running again in the same bucket creates nothing');

-- ----- stationary -----
update public.bus_positions set recorded_at = now() where trip_id = (select v::uuid from ids where k = 'a_pm');
insert into public.location_pings (trip_id, location, recorded_at)
select (select v::uuid from ids where k = 'a_pm'), private.make_point(25.1, 55.2 + g * 0.00001),
       now() - (g * interval '174 seconds')
from generate_series(0, 5) g;   -- 6 pings, the oldest 14.5 minutes ago, all within about 1 m
select is((public.run_watchdogs())->>'alerts_created', '1', 'a bus that has not moved raises a stationary alert');
select is((select count(*)::int from public.alerts where type = 'stationary'), 1, 'a stationary alert exists');

-- one ping 200 m away: no stationary alert for a new bucket
delete from public.alerts where type = 'stationary';
insert into public.location_pings (trip_id, location, recorded_at)
values ((select v::uuid from ids where k = 'a_pm'), private.make_point(25.1018, 55.2), now() - interval '5 minutes');
select is((public.run_watchdogs())->>'alerts_created', '0', 'a ping 200 m away cancels the stationary alert');

-- ----- overdue -----
update public.trips set status = 'in_progress', started_at = now() - interval '4 hours'
where id = (select v::uuid from ids where k = 'a_am');
insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at)
values ((select v::uuid from ids where k = 'a_am'), '11111111-1111-1111-1111-111111111111',
        private.make_point(25.1, 55.2), 25.1, 55.2, now());
select public.run_watchdogs();
select is((select severity::text from public.alerts where type = 'overdue_trip'), 'critical', 'an overdue trip is critical');

-- ----- completed trips never fire -----
update public.trips set status = 'completed' where id in (select v::uuid from ids where k in ('a_pm', 'a_am'));
delete from public.alerts;
select is((public.run_watchdogs())->>'alerts_created', '0', 'nothing fires for completed trips');

select * from finish();
rollback;
