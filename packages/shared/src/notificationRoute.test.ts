import { describe, expect, it } from 'vitest';
import { notificationHref } from './notificationRoute';

describe('notificationHref', () => {
  it('opens the live map for boarding and ETA types', () => {
    for (const type of ['boarded', 'picked_up', 'eta_dropoff', 'eta_pickup']) {
      expect(notificationHref({ type, trip_id: 't1' })).toBe('/(parent)/track/t1');
    }
  });
  it('falls back to parent home when a track type has no trip', () => {
    expect(notificationHref({ type: 'boarded' })).toBe('/(parent)');
  });
  it('opens parent home for other parent types', () => {
    expect(notificationHref({ type: 'dropped', trip_id: 't1' })).toBe('/(parent)');
    expect(notificationHref({ type: 'absence_confirmed' })).toBe('/(parent)');
  });
  it('opens the admin area for school alerts', () => {
    for (const type of ['roll_call_missing', 'trip_forced_end', 'lost_contact', 'stationary', 'overdue_trip']) {
      expect(notificationHref({ type, trip_id: 't1' })).toBe('/(admin)');
    }
  });
  it('ignores payloads that are not ours', () => {
    expect(notificationHref(null)).toBeNull();
    expect(notificationHref({})).toBeNull();
    expect(notificationHref({ type: 5 })).toBeNull();
  });
});
