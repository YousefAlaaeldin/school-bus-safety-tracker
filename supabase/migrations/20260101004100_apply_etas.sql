-- apply_etas: store ETAs on trip_students and fire the "about N minutes away" alert once per student.
-- Service-only (docs/contracts/rpc.md §5).

create or replace function public.apply_etas(p_trip_id uuid, p_etas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip     public.trips%rowtype;
  v_minutes  integer;
  v_item     jsonb;
  v_stop     uuid;
  v_eta      timestamptz;
  v_source   public.eta_source;
  v_row      record;
  v_alerted  integer := 0;
  v_type     public.notification_type;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found or v_trip.status <> 'in_progress' then
    return jsonb_build_object('alerted', 0);
  end if;
  if p_etas is null or jsonb_typeof(p_etas) <> 'array' then
    return jsonb_build_object('alerted', 0);
  end if;

  select eta_alert_minutes into v_minutes from public.schools where id = v_trip.school_id;
  v_type := case when v_trip.direction = 'from_school' then 'eta_dropoff' else 'eta_pickup' end;

  for v_item in select e from jsonb_array_elements(p_etas) as e loop
    v_stop := (v_item->>'stop_id')::uuid;
    v_eta := (v_item->>'eta_at')::timestamptz;
    v_source := (v_item->>'source')::public.eta_source;

    for v_row in
      -- ETAs are kept fresh for everyone still waiting or on board at this stop.
      update public.trip_students ts
      set eta_at = v_eta, eta_source = v_source, eta_updated_at = now()
      where ts.trip_id = p_trip_id
        and ts.stop_id = v_stop
        and ((v_trip.direction = 'from_school' and ts.status = 'boarded')
          or (v_trip.direction = 'to_school' and ts.status = 'expected'))
      returning ts.student_id, ts.eta_alert_sent_at
    loop
      -- The alert fires once, when the bus is within the school's alert window.
      if v_row.eta_alert_sent_at is null and v_eta <= now() + make_interval(mins => v_minutes) then
        update public.trip_students
        set eta_alert_sent_at = now()
        where trip_id = p_trip_id and student_id = v_row.student_id;

        perform private.enqueue_guardian_notifications(
          v_type, p_trip_id, v_row.student_id,
          jsonb_build_object(
            'time_iso', v_eta,
            'minutes', greatest(1, ceil(extract(epoch from (v_eta - now())) / 60)::integer)),
          now());
        v_alerted := v_alerted + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('alerted', v_alerted);
end;
$$;

revoke execute on function public.apply_etas(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_etas(uuid, jsonb) to service_role;
