-- get_eta_work: which active trips need an ETA computed, and for which stops (docs/contracts/rpc.md §5).
-- Service-only: called by the eta-tick Edge Function.

create or replace function public.get_eta_work()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(w.item order by w.departure), '[]'::jsonb)
  from (
    select
      t.scheduled_departure as departure,
      jsonb_build_object(
        'trip_id', t.id,
        'school_id', t.school_id,
        'direction', t.direction,
        'eta_alert_minutes', sc.eta_alert_minutes,
        'origin', jsonb_build_object('lat', bp.lat, 'lng', bp.lng, 'recorded_at', bp.recorded_at),
        'stops', (
          select jsonb_agg(
                   jsonb_build_object(
                     'stop_id', x.stop_id,
                     'sequence', x.seq,
                     'lat', extensions.st_y(st.location::extensions.geometry),
                     'lng', extensions.st_x(st.location::extensions.geometry))
                   order by x.seq)
          from (
            select ts.stop_id, min(ts.stop_sequence) as seq
            from public.trip_students ts
            where ts.trip_id = t.id
              and ts.eta_alert_sent_at is null
              and ((t.direction = 'from_school' and ts.status = 'boarded')
                or (t.direction = 'to_school' and ts.status = 'expected'))
            group by ts.stop_id
            order by min(ts.stop_sequence)
            limit 5
          ) x
          join public.stops st on st.id = x.stop_id
        )
      ) as item
    from public.trips t
    join public.schools sc on sc.id = t.school_id
    join public.bus_positions bp on bp.trip_id = t.id
    where t.status = 'in_progress'
      and bp.recorded_at > now() - interval '2 minutes'
      and exists (
        select 1 from public.trip_students ts
        where ts.trip_id = t.id
          and ts.eta_alert_sent_at is null
          and ((t.direction = 'from_school' and ts.status = 'boarded')
            or (t.direction = 'to_school' and ts.status = 'expected'))
      )
  ) w;
$$;

revoke execute on function public.get_eta_work() from public, anon, authenticated;
grant execute on function public.get_eta_work() to service_role;
