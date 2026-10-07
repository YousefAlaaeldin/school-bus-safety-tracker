-- mark_dropped and undo_dropped (docs/contracts/rpc.md §3)
create or replace function public.mark_dropped(
  p_trip_id          uuid,
  p_student_id       uuid,
  p_client_action_id uuid,
  p_device_time      timestamptz,
  p_lat              double precision default null,
  p_lng              double precision default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_prev     jsonb;
  v_trip     public.trips%rowtype;
  v_ts       public.trip_students%rowtype;
  v_point    extensions.geography;
  v_distance integer;
  v_result   jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'mark_dropped');
  if v_prev is not null then
    return v_prev;
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.direction <> 'from_school' or v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_ts.status <> 'boarded' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  v_point := private.make_point(p_lat, p_lng);
  if v_point is not null then
    select round(extensions.st_distance(v_point, st.location))::integer
    into v_distance
    from public.stops st where st.id = v_ts.stop_id;
  end if;

  update public.trip_students
  set status = 'dropped',
      dropped_at = now(),
      dropped_location = v_point,
      drop_distance_m = v_distance,
      updated_by = v_uid,
      updated_at = now()
  where id = v_ts.id;

  perform private.log_trip_event(p_trip_id, p_student_id, 'student_dropped',
                                 p_client_action_id, p_device_time, p_lat, p_lng,
                                 jsonb_build_object('drop_distance_m', v_distance));
  perform private.enqueue_guardian_notifications(
    'dropped', p_trip_id, p_student_id,
    jsonb_build_object('time_iso', now()), now() + interval '10 seconds');

  v_result := jsonb_build_object('student_id', p_student_id, 'status', 'dropped',
                                 'drop_distance_m', v_distance);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.mark_dropped(uuid, uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.mark_dropped(uuid, uuid, uuid, timestamptz, double precision, double precision) to authenticated;

create or replace function public.undo_dropped(
  p_trip_id          uuid,
  p_student_id       uuid,
  p_client_action_id uuid,
  p_device_time      timestamptz,
  p_lat              double precision default null,
  p_lng              double precision default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_prev   jsonb;
  v_trip   public.trips%rowtype;
  v_ts     public.trip_students%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'undo_dropped');
  if v_prev is not null then
    return v_prev;
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_ts.status <> 'dropped' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  if v_ts.dropped_at is null or v_ts.dropped_at <= now() - interval '2 minutes' then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  update public.trip_students
  set status = 'boarded',
      dropped_at = null,
      dropped_location = null,
      drop_distance_m = null,
      updated_by = v_uid,
      updated_at = now()
  where id = v_ts.id;

  perform private.log_trip_event(p_trip_id, p_student_id, 'student_drop_undone',
                                 p_client_action_id, p_device_time, p_lat, p_lng);
  perform private.cancel_pending_notifications('dropped', p_trip_id, p_student_id);

  v_result := jsonb_build_object('student_id', p_student_id, 'status', 'boarded');
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.undo_dropped(uuid, uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.undo_dropped(uuid, uuid, uuid, timestamptz, double precision, double precision) to authenticated;
