-- run_watchdogs: raises alerts for buses that went silent, stopped moving, or ran far too long.
-- Plain SQL, scheduled every minute. Only creates alerts and notifications with new dedupe keys.

create or replace function public.run_watchdogs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
  v_bucket  text := private.time_bucket_30m();
  v_row     record;
begin
  -- 1. Lost contact: no position (or no start) for 5 minutes.
  for v_row in
    select t.id as trip_id, t.school_id,
           coalesce(bp.recorded_at, t.started_at) as last_seen
    from public.trips t
    left join public.bus_positions bp on bp.trip_id = t.id
    where t.status in ('roll_call', 'in_progress')
      and coalesce(bp.recorded_at, t.started_at) < now() - interval '5 minutes'
  loop
    if private.raise_alert(v_row.school_id, v_row.trip_id, 'lost_contact', 'warning',
                           'lost_contact:' || v_row.trip_id::text || ':' || v_bucket,
                           jsonb_build_object('last_seen', v_row.last_seen)) then
      v_created := v_created + 1;
      perform private.enqueue_admin_notifications(
        'lost_contact', v_row.trip_id, jsonb_build_object('time_iso', v_row.last_seen), v_bucket);
    end if;
  end loop;

  -- 2. Stationary: fresh position, at least 5 pings in 15 minutes spanning 14+ minutes, all within 50 m.
  for v_row in
    select t.id as trip_id, t.school_id
    from public.trips t
    join public.bus_positions bp on bp.trip_id = t.id
    where t.status = 'in_progress'
      and bp.recorded_at > now() - interval '2 minutes'
      and (select count(*) from public.location_pings lp
           where lp.trip_id = t.id and lp.recorded_at > now() - interval '15 minutes') >= 5
      and (select min(lp.recorded_at) from public.location_pings lp
           where lp.trip_id = t.id and lp.recorded_at > now() - interval '15 minutes') <= now() - interval '14 minutes'
      and not exists (
        select 1 from public.location_pings lp
        where lp.trip_id = t.id
          and lp.recorded_at > now() - interval '15 minutes'
          and extensions.st_distance(lp.location, bp.location) > 50
      )
  loop
    if private.raise_alert(v_row.school_id, v_row.trip_id, 'stationary', 'warning',
                           'stationary:' || v_row.trip_id::text || ':' || v_bucket,
                           jsonb_build_object('minutes', 15)) then
      v_created := v_created + 1;
      perform private.enqueue_admin_notifications(
        'stationary', v_row.trip_id, jsonb_build_object('minutes', 15), v_bucket);
    end if;
  end loop;

  -- 3. Overdue: still going after 3 hours.
  for v_row in
    select t.id as trip_id, t.school_id, t.started_at
    from public.trips t
    where t.status in ('roll_call', 'in_progress')
      and t.started_at < now() - interval '3 hours'
  loop
    if private.raise_alert(v_row.school_id, v_row.trip_id, 'overdue_trip', 'critical',
                           'overdue_trip:' || v_row.trip_id::text,
                           jsonb_build_object('started_at', v_row.started_at)) then
      v_created := v_created + 1;
      perform private.enqueue_admin_notifications(
        'overdue_trip', v_row.trip_id, jsonb_build_object('time_iso', v_row.started_at));
    end if;
  end loop;

  return jsonb_build_object('alerts_created', v_created);
end;
$$;

revoke execute on function public.run_watchdogs() from public, anon, authenticated;
grant execute on function public.run_watchdogs() to service_role;

select cron.unschedule(jobname) from cron.job where jobname = 'run-watchdogs';
select cron.schedule('run-watchdogs', '* * * * *', $$ select public.run_watchdogs() $$);
