// End-to-end afternoon trip against the LOCAL stack (needs `supabase start` and `supabase functions serve`
// with PUSH_MOCK=1 and ROUTES_MOCK=1). Not part of the default `pnpm test`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { replayOnce } from '../gps-replay/replay';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// Public demo keys of the local Supabase stack. They only work on a local `supabase start`.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// A fixed Monday far in the future, so the scenario never depends on today's weekday or state.
const SERVICE_DATE = '2031-01-06';
const ROUTE_A_PM = 'e0000000-0000-0000-0000-0000000000a1';

const S1 = 'f0000000-0000-0000-0000-000000000001';
const S2 = 'f0000000-0000-0000-0000-000000000002';
const S3 = 'f0000000-0000-0000-0000-000000000003';
const STOP_A1 = { lat: 25.0935, lng: 55.2105 };
const STOP_A2 = { lat: 25.079, lng: 55.219 };
const PARENT_1 = 'a0000000-0000-0000-0000-000000000003';
const PARENT_2 = 'a0000000-0000-0000-0000-000000000004';

async function expectOk<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

async function wipeDate(service: SupabaseClient) {
  const trips = await expectOk(service.from('trips').select('id').eq('service_date', SERVICE_DATE));
  const ids = trips.map((t) => t.id);
  if (ids.length === 0) return;
  for (const table of ['notification_outbox', 'alerts', 'trip_events', 'location_pings', 'bus_positions', 'trip_students']) {
    await expectOk(service.from(table).delete().in('trip_id', ids));
  }
  await expectOk(service.from('trips').delete().in('id', ids));
}

describe('afternoon trip, end to end', () => {
  it('boards, drives, alerts the parents once and ends cleanly', async () => {
    const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
    await wipeDate(service);
    await expectOk(service.rpc('generate_trips', { p_service_date: SERVICE_DATE }));
    const trips = await expectOk(
      service.from('trips').select('id').eq('route_id', ROUTE_A_PM).eq('service_date', SERVICE_DATE),
    );
    const tripId = trips[0]!.id;

    // Sign in as HELPER_A with the local test OTP.
    const helper = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
    await expectOk(helper.auth.signInWithOtp({ phone: '+971500000002' }));
    await expectOk(helper.auth.verifyOtp({ phone: '+971500000002', token: '123456', type: 'sms' }));

    const act = (rpc: string, args: Record<string, unknown>) =>
      expectOk(
        helper.rpc(rpc, {
          ...args,
          p_client_action_id: randomUUID(),
          p_device_time: new Date().toISOString(),
        }),
      );

    await act('start_trip', { p_trip_id: tripId });
    for (const student of [S1, S2, S3]) {
      await act('set_boarded', { p_trip_id: tripId, p_student_id: student, p_boarded: true });
    }
    await act('confirm_roll_call', { p_trip_id: tripId });

    // Drive the route at x20, running eta-tick about once per simulated minute.
    let lastTick = -60;
    const tick = async () => {
      const res = await fetch(`${URL}/functions/v1/eta-tick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      });
      expect(res.ok).toBe(true);
    };
    await replayOnce({
      tripId,
      phone: '+971500000002',
      otp: '123456',
      speed: 20,
      interval: 10,
      client: helper,
      onProgress: ({ simSeconds }) => {
        if (simSeconds - lastTick >= 60) {
          lastTick = simSeconds;
          void tick();
        }
      },
    });
    await tick();
    await new Promise((r) => setTimeout(r, 1500));

    // Each boarded child's guardian got exactly one eta_dropoff, created when the ETA was 10 minutes or less.
    const outbox = await expectOk(
      service.from('notification_outbox').select('student_id, recipient_user_id, params').eq('trip_id', tripId).eq('type', 'eta_dropoff'),
    );
    for (const [student, parent] of [[S1, PARENT_1], [S2, PARENT_1], [S3, PARENT_2]] as const) {
      const rows = outbox.filter((r) => r.student_id === student && r.recipient_user_id === parent);
      expect(rows, `eta_dropoff for ${student}`).toHaveLength(1);
      const minutes = Number((rows[0]!.params as { minutes: number }).minutes);
      expect(minutes).toBeGreaterThanOrEqual(1);
      expect(minutes).toBeLessThanOrEqual(10);
    }

    // Drop everyone at their stop, then end the trip.
    await act('mark_dropped', { p_trip_id: tripId, p_student_id: S1, p_lat: STOP_A1.lat, p_lng: STOP_A1.lng });
    await act('mark_dropped', { p_trip_id: tripId, p_student_id: S2, p_lat: STOP_A1.lat, p_lng: STOP_A1.lng });
    await act('mark_dropped', { p_trip_id: tripId, p_student_id: S3, p_lat: STOP_A2.lat, p_lng: STOP_A2.lng });

    const dropped = await expectOk(
      service.from('trip_students').select('student_id').eq('trip_id', tripId).eq('status', 'dropped'),
    );
    expect(dropped.map((d) => d.student_id).sort()).toEqual([S1, S2, S3].sort());

    await act('end_trip', { p_trip_id: tripId, p_force: false, p_reason: null });
    const [ended] = await expectOk(service.from('trips').select('status, end_forced').eq('id', tripId));
    expect(ended).toMatchObject({ status: 'completed', end_forced: false });
  });
});
