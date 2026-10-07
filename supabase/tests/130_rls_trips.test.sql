begin;
select plan(11);

select tests.make_fixture_trips();  -- as postgres: trips for 2030-01-07

-- A_PM = e0..a1 (from_school), A_AM = e0..a2 (to_school)
update public.trips set status = 'in_progress'
where service_date = '2030-01-07' and route_id in
  ('e0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a2');

insert into public.bus_positions (trip_id, school_id, location, lat, lng, recorded_at)
select t.id, t.school_id, private.make_point(25.09, 55.21), 25.09, 55.21, now()
from public.trips t
where t.service_date = '2030-01-07' and t.route_id in
  ('e0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a2');

-- HELPER_A
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.trips), 2, 'helper A sees A_PM and A_AM');
select is((select count(*)::int from public.trip_students), 10, 'helper A sees all trip_students of both trips');
select is((select count(*)::int from public.bus_positions), 2, 'helper A sees both bus positions');
select tests.clear_authentication();

-- ADMIN_A sees positions too
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.bus_positions), 2, 'admin A sees both bus positions');
select tests.clear_authentication();

-- PARENT_1: only their own children's trip_students (2 children x 2 trips)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.trip_students), 4, 'parent 1 sees only STUDENT_1 and STUDENT_2 rows');
select tests.clear_authentication();

-- A_PM (afternoon): parent sees the bus only while their child is on board
update public.trip_students set status = 'boarded'
where student_id = 'f0000000-0000-0000-0000-000000000001'
  and trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.bus_positions
           where trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07')),
          1, 'parent 1 sees the A_PM bus while STUDENT_1 is boarded');
select tests.clear_authentication();

update public.trip_students set status = 'dropped'
where student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')
  and trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.bus_positions
           where trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07')),
          0, 'parent 1 loses the A_PM bus after both children are dropped');
select tests.clear_authentication();

-- A_AM (morning): parent sees the bus while it is coming for their child
select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- PARENT_2, STUDENT_3
select is((select count(*)::int from public.bus_positions
           where trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07')),
          1, 'parent 2 sees the A_AM bus while STUDENT_3 is expected');
select tests.clear_authentication();

update public.trip_students set status = 'missing'
where student_id = 'f0000000-0000-0000-0000-000000000003'
  and trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.bus_positions), 0, 'parent 2 loses the A_AM bus after a no-show');
select tests.clear_authentication();

-- can_track = false hides the bus even while the child is on board (both PARENT_1 links)
update public.trip_students set status = 'boarded'
where student_id = 'f0000000-0000-0000-0000-000000000001'
  and trip_id = (select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07');
update public.guardian_links set can_track = false where guardian_user_id = 'a0000000-0000-0000-0000-000000000003';
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.bus_positions), 0, 'parent 1 sees no position when can_track is false');
select tests.clear_authentication();

-- ADMIN_B sees nothing of school A
select tests.authenticate_as('b0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.trips where school_id = '11111111-1111-1111-1111-111111111111'),
          0, 'admin B sees no school-A trips');
select tests.clear_authentication();

select * from finish();
rollback;
