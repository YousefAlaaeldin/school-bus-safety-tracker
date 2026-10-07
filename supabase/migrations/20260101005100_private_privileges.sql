-- Found by the security regression test (T5.02): Supabase's default privileges granted EXECUTE on
-- every function in schema private to anon and authenticated. Only the RLS helpers may be callable.

revoke execute on all functions in schema private from public, anon, authenticated;

-- Functions created later stay locked down too.
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

-- The RLS helpers (T1.11) are the only functions in private that signed-in users may execute.
grant execute on function
  private.is_school_admin(uuid),
  private.is_school_helper(uuid),
  private.is_school_staff(uuid),
  private.my_student_ids(),
  private.my_tracking_student_ids(),
  private.is_guardian_in_school(uuid),
  private.is_trip_helper(uuid),
  private.trip_school_id(uuid),
  private.can_view_bus(uuid),
  private.helper_student_ids(),
  private.helper_stop_ids(),
  private.guardian_stop_ids(),
  private.admin_can_see_profile(uuid)
to authenticated;
