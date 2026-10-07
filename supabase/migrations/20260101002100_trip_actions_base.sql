-- Helpers shared by every helper trip action, plus start_trip (docs/contracts/rpc.md §1, §3).

-- Idempotency: a replayed tap returns the first result.
create or replace function private.claim_client_action(p_id uuid, p_rpc text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.client_actions%rowtype;
begin
  select * into v_existing from public.client_actions where id = p_id;
  if found then
    if v_existing.user_id = auth.uid() then
      return v_existing.result;
    end if;
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  insert into public.client_actions (id, user_id, rpc, result)
  values (p_id, auth.uid(), p_rpc, '{}'::jsonb);
  return null;
end;
$$;

create or replace function private.save_client_action_result(p_id uuid, p_result jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.client_actions set result = p_result where id = p_id;
$$;

create or replace function private.log_trip_event(
  p_trip_id uuid,
  p_student_id uuid,
  p_type public.trip_event_type,
  p_client_action_id uuid,
  p_device_time timestamptz,
  p_lat double precision,
  p_lng double precision,
  p_payload jsonb default '{}'
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.trip_events (
    trip_id, student_id, type, actor_id, client_action_id, device_time, location, payload
  )
  values (
    p_trip_id, p_student_id, p_type, auth.uid(), p_client_action_id, p_device_time,
    private.make_point(p_lat, p_lng), coalesce(p_payload, '{}'::jsonb)
  );
$$;

-- {child_ar, child_en, bus_ar, bus_en, stop_ar, stop_en} for notification templates.
create or replace function private.student_notification_params(p_trip_id uuid, p_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'child_ar', s.name_ar, 'child_en', s.name_en,
    'bus_ar', b.label_ar, 'bus_en', b.label_en,
    'stop_ar', st.label_ar, 'stop_en', st.label_en
  )
  from public.trips t
  join public.buses b on b.id = t.bus_id
  join public.students s on s.id = p_student_id
  left join public.trip_students ts on ts.trip_id = t.id and ts.student_id = s.id
  left join public.stops st on st.id = ts.stop_id
  where t.id = p_trip_id;
$$;

-- 30-minute bucket used in dedupe keys for repeatable alerts.
create or replace function private.time_bucket_30m()
returns text
language sql
stable
set search_path = ''
as $$
  select floor(extract(epoch from now()) / 1800)::bigint::text;
$$;

-- start_trip --------------------------------------------------------------------------------------
create or replace function public.start_trip(
  p_trip_id          uuid,
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
  v_status public.trip_status;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- 1. idempotency: a replayed tap returns the first result
  v_prev := private.claim_client_action(p_client_action_id, 'start_trip');
  if v_prev is not null then
    return v_prev;
  end if;

  -- 2. lock + authorize + state check
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.status <> 'scheduled' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- 3. apply
  v_status := case when v_trip.direction = 'from_school'
                   then 'roll_call'::public.trip_status
                   else 'in_progress'::public.trip_status end;
  update public.trips set status = v_status, started_at = now() where id = p_trip_id;

  -- 4. audit
  perform private.log_trip_event(p_trip_id, null, 'trip_started',
                                 p_client_action_id, p_device_time, p_lat, p_lng);

  -- 5. remember result for replays, return
  v_result := jsonb_build_object('trip_id', p_trip_id, 'status', v_status);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.start_trip(uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.start_trip(uuid, uuid, timestamptz, double precision, double precision) to authenticated;
