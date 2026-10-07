-- generate_trips(date): creates the day's trips and their trip_students. Service-only (cron / Edge Functions).

create or replace function public.generate_trips(p_service_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route record;
  v_time time;
  v_trip_id uuid;
  v_count integer := 0;
  v_dow integer := extract(dow from p_service_date)::integer;
  v_cal public.school_calendar%rowtype;
begin
  for v_route in
    select r.id as route_id, r.school_id, r.bus_id, r.direction, r.default_helper_id,
           s.timezone, s.weekend_days
    from public.routes r
    join public.schools s on s.id = r.school_id
    where r.active
  loop
    -- 1. weekend
    if v_dow = any (v_route.weekend_days::integer[]) then
      continue;
    end if;

    -- 2. holiday / closure
    select * into v_cal
    from public.school_calendar c
    where c.school_id = v_route.school_id and c.date = p_service_date;
    if found and v_cal.type in ('holiday', 'closure') then
      continue;
    end if;

    -- 3. schedule for this weekday
    select rs.departure_time into v_time
    from public.route_schedules rs
    where rs.route_id = v_route.route_id and rs.weekday = v_dow;
    if not found then
      continue;
    end if;

    -- 4. calendar override
    if v_cal.id is not null then
      if v_route.direction = 'to_school' then
        v_time := coalesce(v_cal.am_departure_override, v_time);
      else
        v_time := coalesce(v_cal.pm_departure_override, v_time);
      end if;
    end if;
    -- reset so a calendar row of an earlier route does not leak into the next one
    v_cal := null;

    -- 5 + 6. insert the trip (once per route and date)
    v_trip_id := null;
    insert into public.trips (
      school_id, route_id, bus_id, helper_id, direction, service_date, scheduled_departure
    )
    values (
      v_route.school_id, v_route.route_id, v_route.bus_id, v_route.default_helper_id,
      v_route.direction, p_service_date,
      ((p_service_date + v_time)::timestamp at time zone v_route.timezone)
    )
    on conflict (route_id, service_date) do nothing
    returning id into v_trip_id;

    if v_trip_id is null then
      continue;
    end if;
    v_count := v_count + 1;

    -- 7. trip_students for the newly inserted trip only
    insert into public.trip_students (trip_id, student_id, stop_id, stop_sequence, status)
    select v_trip_id, sa.student_id, sa.stop_id, rst.sequence,
           case when exists (
             select 1 from public.absence_reports ar
             where ar.student_id = sa.student_id
               and ar.service_date = p_service_date
               and ar.direction = v_route.direction
           ) then 'absent_reported'::public.student_trip_status
           else 'expected'::public.student_trip_status end
    from public.student_assignments sa
    join public.students st on st.id = sa.student_id and st.active
    join public.route_stops rst on rst.route_id = sa.route_id and rst.stop_id = sa.stop_id
    where sa.route_id = v_route.route_id
      and v_dow = any (sa.weekdays::integer[])
      and sa.valid_from <= p_service_date
      and (sa.valid_to is null or sa.valid_to >= p_service_date);
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.generate_trips(date) from public, anon, authenticated;
grant execute on function public.generate_trips(date) to service_role;
