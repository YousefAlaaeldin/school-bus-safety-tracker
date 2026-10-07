create type public.membership_role      as enum ('admin', 'helper');
create type public.link_status          as enum ('pending', 'approved', 'revoked');
create type public.trip_direction       as enum ('to_school', 'from_school');
create type public.trip_status          as enum ('scheduled', 'roll_call', 'in_progress', 'completed', 'cancelled');
create type public.student_trip_status  as enum ('expected', 'absent_reported', 'boarded', 'missing', 'dropped', 'returned_to_school');
create type public.calendar_day_type    as enum ('holiday', 'closure', 'early_dismissal', 'ramadan_hours');
create type public.locale_code          as enum ('ar', 'en');
create type public.device_platform      as enum ('ios', 'android');
create type public.eta_source           as enum ('routes_api', 'fallback');
create type public.notification_status  as enum ('pending', 'cancelled', 'sent', 'failed');
create type public.alert_severity       as enum ('info', 'warning', 'critical');
create type public.notification_type    as enum (
  'boarded', 'picked_up', 'no_show', 'eta_dropoff', 'eta_pickup', 'dropped',
  'arrived_school', 'returned_to_school', 'missing_child',
  'roll_call_missing', 'trip_forced_end', 'lost_contact', 'stationary', 'overdue_trip'
);
create type public.alert_type           as enum (
  'roll_call_missing', 'no_show', 'student_returned', 'trip_forced_end',
  'lost_contact', 'stationary', 'overdue_trip'
);
create type public.trip_event_type      as enum (
  'trip_started', 'student_boarded', 'student_unboarded', 'roll_call_confirmed',
  'student_dropped', 'student_drop_undone', 'student_no_show', 'student_no_show_undone', 'student_returned',
  'arrived_school', 'trip_ended', 'absence_reported', 'absence_cancelled'
);
