-- RLS policies: trips and everything else, plus Realtime (docs/contracts/rls.md §2–§4, data-model §4).
-- client_actions gets no policies on purpose: only RPCs touch it.

-- trips
create policy trips_select_visible on public.trips
  for select to authenticated
  using (
    private.is_school_admin(school_id)
    or helper_id = auth.uid()
    or exists (
      select 1 from public.trip_students ts
      where ts.trip_id = trips.id and ts.student_id in (select private.my_student_ids())
    )
  );

create policy trips_update_admin on public.trips
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

-- Column-limited updates: helper_id only.
revoke update on public.trips from authenticated;
grant update (helper_id) on public.trips to authenticated;

-- trip_students
create policy trip_students_select_visible on public.trip_students
  for select to authenticated
  using (
    private.is_school_admin(private.trip_school_id(trip_id))
    or private.is_trip_helper(trip_id)
    or student_id in (select private.my_student_ids())
  );

-- trip_events
create policy trip_events_select_staff on public.trip_events
  for select to authenticated
  using (
    private.is_school_admin(private.trip_school_id(trip_id))
    or private.is_trip_helper(trip_id)
  );

-- bus_positions
create policy bus_positions_select_viewer on public.bus_positions
  for select to authenticated
  using (private.can_view_bus(trip_id));

-- location_pings
create policy location_pings_select_admin on public.location_pings
  for select to authenticated
  using (private.is_school_admin(private.trip_school_id(trip_id)));

-- absence_reports
create policy absence_reports_select_visible on public.absence_reports
  for select to authenticated
  using (
    student_id in (select private.my_student_ids())
    or exists (
      select 1 from public.students s
      where s.id = absence_reports.student_id and private.is_school_admin(s.school_id)
    )
  );

-- push_tokens
create policy push_tokens_select_self on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy push_tokens_delete_self on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

-- notification_outbox
create policy notification_outbox_select_recipient on public.notification_outbox
  for select to authenticated
  using (recipient_user_id = auth.uid());

-- alerts
create policy alerts_select_admin on public.alerts
  for select to authenticated
  using (private.is_school_admin(school_id));

-- Realtime
alter publication supabase_realtime
  add table public.bus_positions, public.trip_students, public.alerts, public.trips;
