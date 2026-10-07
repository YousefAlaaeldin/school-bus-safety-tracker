/** Where a tapped push notification should open (docs/contracts/app-routes-env.md §3). */

const TRACK_TYPES = new Set(['boarded', 'picked_up', 'eta_dropoff', 'eta_pickup']);
const ADMIN_TYPES = new Set(['roll_call_missing', 'trip_forced_end', 'lost_contact', 'stationary', 'overdue_trip']);

export type NotificationData = { type?: unknown; trip_id?: unknown };

/** Returns an expo-router path, or null when the payload is not one of ours. */
export function notificationHref(data: NotificationData | null | undefined): string | null {
  const type = typeof data?.type === 'string' ? data.type : null;
  if (!type) return null;
  if (ADMIN_TYPES.has(type)) return '/(admin)';
  if (TRACK_TYPES.has(type)) {
    const tripId = typeof data?.trip_id === 'string' ? data.trip_id : null;
    return tripId ? `/(parent)/track/${tripId}` : '/(parent)';
  }
  return '/(parent)';
}
