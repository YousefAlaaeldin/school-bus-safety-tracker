-- ingest_pings: the helper's phone uploads GPS pings (docs/contracts/rpc.md §4).
-- Not idempotent through client_actions; duplicates are ignored by unique (trip_id, recorded_at).

create or replace function public.ingest_pings(p_trip_id uuid, p_pings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_trip      public.trips%rowtype;
  v_item      jsonb;
  v_lat       double precision;
  v_lng       double precision;
  v_recorded  timestamptz;
  v_heading   real;
  v_speed     real;
  v_accuracy  real;
  v_inserted  integer := 0;
  v_row_count integer;
  v_latest    record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_trip from public.trips where id = p_trip_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if p_pings is null or jsonb_typeof(p_pings) <> 'array' or jsonb_array_length(p_pings) > 500 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- An inactive trip is not an error, so the phone's queue can drain.
  if v_trip.status not in ('roll_call', 'in_progress') then
    return jsonb_build_object('inserted', 0);
  end if;

  create temp table if not exists pg_temp.ingest_valid (
    lat double precision, lng double precision, recorded_at timestamptz,
    heading real, speed_mps real, accuracy_m real
  ) on commit drop;
  truncate pg_temp.ingest_valid;

  for v_item in select e from jsonb_array_elements(p_pings) as e loop
    begin
      v_lat := (v_item->>'lat')::double precision;
      v_lng := (v_item->>'lng')::double precision;
      v_recorded := (v_item->>'recorded_at')::timestamptz;
      v_heading := (v_item->>'heading')::real;
      v_speed := (v_item->>'speed_mps')::real;
      v_accuracy := (v_item->>'accuracy_m')::real;
    exception when others then
      continue;  -- unparsable item: skip silently
    end;
    if v_lat is null or v_lng is null or v_recorded is null
       or v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180 then
      continue;
    end if;

    insert into pg_temp.ingest_valid values (v_lat, v_lng, v_recorded, v_heading, v_speed, v_accuracy);
    insert into public.location_pings (trip_id, location, heading, speed_mps, accuracy_m, recorded_at)
    values (p_trip_id, private.make_point(v_lat, v_lng), v_heading, v_speed, v_accuracy, v_recorded)
    on conflict (trip_id, recorded_at) do nothing;
    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
  end loop;

  -- The newest ping of the batch becomes the bus position, only if it is newer than the stored one.
  select * into v_latest from pg_temp.ingest_valid order by recorded_at desc limit 1;
  if found then
    insert into public.bus_positions (
      trip_id, school_id, location, lat, lng, heading, speed_mps, accuracy_m, recorded_at, updated_at
    )
    values (
      p_trip_id, v_trip.school_id, private.make_point(v_latest.lat, v_latest.lng),
      v_latest.lat, v_latest.lng, v_latest.heading, v_latest.speed_mps, v_latest.accuracy_m,
      v_latest.recorded_at, now()
    )
    on conflict (trip_id) do update
      set location = excluded.location, lat = excluded.lat, lng = excluded.lng,
          heading = excluded.heading, speed_mps = excluded.speed_mps,
          accuracy_m = excluded.accuracy_m, recorded_at = excluded.recorded_at, updated_at = now()
      where public.bus_positions.recorded_at < excluded.recorded_at;
  end if;

  return jsonb_build_object('inserted', v_inserted);
end;
$$;

revoke execute on function public.ingest_pings(uuid, jsonb) from public, anon;
grant  execute on function public.ingest_pings(uuid, jsonb) to authenticated;
