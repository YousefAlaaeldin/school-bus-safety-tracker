begin;
select plan(13);

-- 2030-01-07 is a Monday
select is(public.generate_trips('2030-01-07'), 3, 'generates ROUTE_A_PM, ROUTE_A_AM and ROUTE_B_PM');
select is(public.generate_trips('2030-01-07'), 0, 'a second call creates nothing');
select is((select count(*)::int from public.trip_students ts join public.trips t on t.id = ts.trip_id
           where t.route_id = 'e0000000-0000-0000-0000-0000000000a1' and t.service_date = '2030-01-07'
             and ts.status = 'expected'), 5, 'A_PM has 5 expected trip_students');
select is((select ts.stop_sequence from public.trip_students ts join public.trips t on t.id = ts.trip_id
           where t.route_id = 'e0000000-0000-0000-0000-0000000000a1' and t.service_date = '2030-01-07'
             and ts.student_id = 'f0000000-0000-0000-0000-000000000003'), 3, 'STUDENT_3 stop_sequence is 3 on A_PM');
select is((select scheduled_departure from public.trips
           where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07'),
          '2030-01-07 14:30 Asia/Dubai'::timestamptz, 'A_PM departs at 14:30 Dubai time');
select is((select helper_id from public.trips
           where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07'),
          'a0000000-0000-0000-0000-000000000002'::uuid, 'the default helper is assigned');

-- Saturday: weekend for both schools
select is(public.generate_trips('2030-01-05'), 0, 'nothing on a Saturday');

-- Friday: school A runs (2 routes), school B is on weekend
select is(public.generate_trips('2030-01-11'), 2, 'Friday: school A creates 2 trips, school B none');

-- holiday for school A on Tuesday 2030-01-08: only school B runs
insert into public.school_calendar (school_id, date, type)
values ('11111111-1111-1111-1111-111111111111', '2030-01-08', 'holiday');
select is(public.generate_trips('2030-01-08'), 1, 'holiday: school A creates none, school B creates 1');

-- ramadan hours on Wednesday 2030-01-09
insert into public.school_calendar (school_id, date, type, pm_departure_override)
values ('11111111-1111-1111-1111-111111111111', '2030-01-09', 'ramadan_hours', '12:30');
select public.generate_trips('2030-01-09');
select is((select scheduled_departure from public.trips
           where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-09'),
          '2030-01-09 12:30 Asia/Dubai'::timestamptz, 'ramadan override moves A_PM to 12:30');
select is((select scheduled_departure from public.trips
           where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-09'),
          '2030-01-09 06:45 Asia/Dubai'::timestamptz, 'the pm override does not touch the morning route');

-- absence on Thursday 2030-01-10
insert into public.absence_reports (student_id, service_date, direction)
values ('f0000000-0000-0000-0000-000000000001', '2030-01-10', 'from_school');
select public.generate_trips('2030-01-10');
select is((select ts.status::text from public.trip_students ts join public.trips t on t.id = ts.trip_id
           where t.route_id = 'e0000000-0000-0000-0000-0000000000a1' and t.service_date = '2030-01-10'
             and ts.student_id = 'f0000000-0000-0000-0000-000000000001'), 'absent_reported',
          'a reported absence is applied at generation');

-- authenticated users cannot execute it
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.generate_trips('2030-01-14') $$, '42501', null,
                 'authenticated users cannot call generate_trips');
select tests.clear_authentication();

select * from finish();
rollback;
