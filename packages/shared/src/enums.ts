export const MEMBERSHIP_ROLES = ['admin', 'helper'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const LINK_STATUSES = ['pending', 'approved', 'revoked'] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const TRIP_DIRECTIONS = ['to_school', 'from_school'] as const;
export type TripDirection = (typeof TRIP_DIRECTIONS)[number];

export const TRIP_STATUSES = [
  'scheduled',
  'roll_call',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const STUDENT_TRIP_STATUSES = [
  'expected',
  'absent_reported',
  'boarded',
  'missing',
  'dropped',
  'returned_to_school',
] as const;
export type StudentTripStatus = (typeof STUDENT_TRIP_STATUSES)[number];

export const CALENDAR_DAY_TYPES = [
  'holiday',
  'closure',
  'early_dismissal',
  'ramadan_hours',
] as const;
export type CalendarDayType = (typeof CALENDAR_DAY_TYPES)[number];

export const LOCALE_CODES = ['ar', 'en'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const DEVICE_PLATFORMS = ['ios', 'android'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const ETA_SOURCES = ['routes_api', 'fallback'] as const;
export type EtaSource = (typeof ETA_SOURCES)[number];

export const NOTIFICATION_STATUSES = ['pending', 'cancelled', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const NOTIFICATION_TYPES = [
  'boarded',
  'picked_up',
  'no_show',
  'eta_dropoff',
  'eta_pickup',
  'dropped',
  'arrived_school',
  'returned_to_school',
  'missing_child',
  'roll_call_missing',
  'trip_forced_end',
  'lost_contact',
  'stationary',
  'overdue_trip',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ALERT_TYPES = [
  'roll_call_missing',
  'no_show',
  'student_returned',
  'trip_forced_end',
  'lost_contact',
  'stationary',
  'overdue_trip',
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const TRIP_EVENT_TYPES = [
  'trip_started',
  'student_boarded',
  'student_unboarded',
  'roll_call_confirmed',
  'student_dropped',
  'student_drop_undone',
  'student_no_show',
  'student_no_show_undone',
  'student_returned',
  'arrived_school',
  'trip_ended',
  'absence_reported',
  'absence_cancelled',
] as const;
export type TripEventType = (typeof TRIP_EVENT_TYPES)[number];

export const RPC_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'NOT_AUTHORIZED',
  'NOT_FOUND',
  'INVALID_STATE',
  'INVALID_INPUT',
  'STUDENTS_ON_BOARD',
  'PAST_CUTOFF',
  'UNDO_WINDOW_PASSED',
  'INVITE_INVALID',
  'INVITE_USED',
  'INVITE_EXPIRED',
] as const;
export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];
