-- Notification outbox and alert helpers (docs/contracts/rpc.md §1, data-model §3).

-- One outbox row per approved guardian who has an account. Re-enqueueing revives a cancelled row.
create or replace function private.enqueue_guardian_notifications(
  p_type public.notification_type,
  p_trip_id uuid,
  p_student_id uuid,
  p_extra jsonb,
  p_send_after timestamptz
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_params jsonb;
  v_count integer;
begin
  v_params := private.student_notification_params(p_trip_id, p_student_id) || coalesce(p_extra, '{}'::jsonb);

  insert into public.notification_outbox (
    dedupe_key, type, recipient_user_id, school_id, trip_id, student_id, params, send_after
  )
  select
    p_type::text || ':' || coalesce(p_trip_id::text, '-') || ':' || coalesce(p_student_id::text, '-')
      || ':' || gl.guardian_user_id::text,
    p_type, gl.guardian_user_id, s.school_id, p_trip_id, p_student_id, v_params, p_send_after
  from public.guardian_links gl
  join public.students s on s.id = gl.student_id
  where gl.student_id = p_student_id
    and gl.status = 'approved'
    and gl.guardian_user_id is not null
  on conflict (dedupe_key) do update
    set status = 'pending',
        send_after = excluded.send_after,
        params = excluded.params,
        claimed_at = null
    where public.notification_outbox.status = 'cancelled';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- One outbox row per admin of the trip's school. A repeat with the same slot is ignored.
create or replace function private.enqueue_admin_notifications(
  p_type public.notification_type,
  p_trip_id uuid,
  p_extra jsonb,
  p_dedupe_slot text default '-'
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_outbox (
    dedupe_key, type, recipient_user_id, school_id, trip_id, params
  )
  select
    p_type::text || ':' || p_trip_id::text || ':' || p_dedupe_slot || ':' || m.user_id::text,
    p_type, m.user_id, t.school_id, t.id,
    jsonb_build_object('bus_ar', b.label_ar, 'bus_en', b.label_en) || coalesce(p_extra, '{}'::jsonb)
  from public.trips t
  join public.buses b on b.id = t.bus_id
  join public.memberships m on m.school_id = t.school_id and m.role = 'admin'
  where t.id = p_trip_id
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Used by the undo paths: flips a still-pending row to cancelled.
create or replace function private.cancel_pending_notifications(
  p_type public.notification_type,
  p_trip_id uuid,
  p_student_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notification_outbox
  set status = 'cancelled'
  where status = 'pending'
    and type = p_type
    and trip_id is not distinct from p_trip_id
    and student_id is not distinct from p_student_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Returns true if a new alert was inserted (false if the dedupe key already exists).
create or replace function private.raise_alert(
  p_school_id uuid,
  p_trip_id uuid,
  p_type public.alert_type,
  p_severity public.alert_severity,
  p_dedupe_key text,
  p_payload jsonb default '{}'
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.alerts (school_id, trip_id, type, severity, dedupe_key, payload)
  values (p_school_id, p_trip_id, p_type, p_severity, p_dedupe_key, coalesce(p_payload, '{}'::jsonb))
  on conflict (dedupe_key) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;
