import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../geo';
import { buildAction, type HelperRpc, type QueuedAction } from '../queue/queue';
import { todayInDubai } from '../time';
import { applyPending, counts, groupByStop, type StudentRow, type TripRow } from './view';

const T = 'trip-1';
let tick = 0;
function act(rpc: HelperRpc, args: Record<string, unknown> = {}): QueuedAction {
  tick += 1;
  return buildAction(
    rpc,
    { p_trip_id: T, ...args },
    { id: `a${tick}`, now: new Date(Date.UTC(2030, 0, 7, 5, 0, tick)), lat: null, lng: null },
  );
}

const trip = (direction: TripRow['direction'], status: TripRow['status']): TripRow => ({
  id: T,
  direction,
  status,
});
const stu = (id: string, status: StudentRow['status'], seq = 1): StudentRow => ({
  student_id: id,
  stop_id: `stop-${seq}`,
  stop_sequence: seq,
  status,
  name_ar: id,
  name_en: id,
  photo_path: null,
});
const statusOf = (r: ReturnType<typeof applyPending>, id: string) =>
  r.students.find((s) => s.student_id === id)?.status;

describe('applyPending', () => {
  it('start_trip: from_school -> roll_call, to_school -> in_progress', () => {
    expect(applyPending(trip('from_school', 'scheduled'), [], [act('start_trip')]).trip.status).toBe(
      'roll_call',
    );
    expect(applyPending(trip('to_school', 'scheduled'), [], [act('start_trip')]).trip.status).toBe(
      'in_progress',
    );
  });

  it('set_boarded true marks boarded and pending', () => {
    const r = applyPending(
      trip('from_school', 'roll_call'),
      [stu('s1', 'expected')],
      [act('set_boarded', { p_student_id: 's1', p_boarded: true })],
    );
    expect(statusOf(r, 's1')).toBe('boarded');
    expect(r.students[0]?.pending).toBe(true);
  });

  it('set_boarded true from missing or absent_reported', () => {
    const r = applyPending(
      trip('to_school', 'in_progress'),
      [stu('s1', 'missing'), stu('s2', 'absent_reported')],
      [
        act('set_boarded', { p_student_id: 's1', p_boarded: true }),
        act('set_boarded', { p_student_id: 's2', p_boarded: true }),
      ],
    );
    expect(statusOf(r, 's1')).toBe('boarded');
    expect(statusOf(r, 's2')).toBe('boarded');
  });

  it('set_boarded true on dropped is ignored', () => {
    const r = applyPending(
      trip('from_school', 'in_progress'),
      [stu('s1', 'dropped')],
      [act('set_boarded', { p_student_id: 's1', p_boarded: true })],
    );
    expect(statusOf(r, 's1')).toBe('dropped');
    expect(r.students[0]?.pending).toBe(false);
  });

  it('un-board in roll_call goes back to expected', () => {
    const r = applyPending(
      trip('from_school', 'roll_call'),
      [stu('s1', 'boarded')],
      [act('set_boarded', { p_student_id: 's1', p_boarded: false })],
    );
    expect(statusOf(r, 's1')).toBe('expected');
  });

  it('un-board in in_progress (from_school) goes to missing', () => {
    const r = applyPending(
      trip('from_school', 'in_progress'),
      [stu('s1', 'boarded')],
      [act('set_boarded', { p_student_id: 's1', p_boarded: false })],
    );
    expect(statusOf(r, 's1')).toBe('missing');
  });

  it('un-board in to_school goes to expected', () => {
    const r = applyPending(
      trip('to_school', 'in_progress'),
      [stu('s1', 'boarded')],
      [act('set_boarded', { p_student_id: 's1', p_boarded: false })],
    );
    expect(statusOf(r, 's1')).toBe('expected');
  });

  it('confirm_roll_call turns expected into missing and starts the trip', () => {
    const r = applyPending(
      trip('from_school', 'roll_call'),
      [stu('s1', 'expected'), stu('s2', 'boarded'), stu('s3', 'absent_reported')],
      [act('confirm_roll_call')],
    );
    expect(r.trip.status).toBe('in_progress');
    expect(statusOf(r, 's1')).toBe('missing');
    expect(statusOf(r, 's2')).toBe('boarded');
    expect(statusOf(r, 's3')).toBe('absent_reported');
  });

  it('mark_dropped and undo_dropped', () => {
    const base = trip('from_school', 'in_progress');
    const dropped = applyPending(base, [stu('s1', 'boarded')], [
      act('mark_dropped', { p_student_id: 's1' }),
    ]);
    expect(statusOf(dropped, 's1')).toBe('dropped');
    const undone = applyPending(base, [stu('s1', 'boarded')], [
      act('mark_dropped', { p_student_id: 's1' }),
      act('undo_dropped', { p_student_id: 's1' }),
    ]);
    expect(statusOf(undone, 's1')).toBe('boarded');
  });

  it('mark_no_show and undo_no_show', () => {
    const base = trip('to_school', 'in_progress');
    const r1 = applyPending(base, [stu('s1', 'expected')], [act('mark_no_show', { p_student_id: 's1' })]);
    expect(statusOf(r1, 's1')).toBe('missing');
    const r2 = applyPending(base, [stu('s1', 'expected')], [
      act('mark_no_show', { p_student_id: 's1' }),
      act('undo_no_show', { p_student_id: 's1' }),
    ]);
    expect(statusOf(r2, 's1')).toBe('expected');
  });

  it('arrive_at_school drops every boarded student', () => {
    const r = applyPending(
      trip('to_school', 'in_progress'),
      [stu('s1', 'boarded'), stu('s2', 'missing'), stu('s3', 'boarded')],
      [act('arrive_at_school')],
    );
    expect(statusOf(r, 's1')).toBe('dropped');
    expect(statusOf(r, 's2')).toBe('missing');
    expect(statusOf(r, 's3')).toBe('dropped');
  });

  it('mark_returned_to_school', () => {
    const r = applyPending(
      trip('from_school', 'in_progress'),
      [stu('s1', 'boarded')],
      [act('mark_returned_to_school', { p_student_id: 's1' })],
    );
    expect(statusOf(r, 's1')).toBe('returned_to_school');
  });

  it('end_trip completes; to_school expected become missing', () => {
    const r = applyPending(
      trip('to_school', 'in_progress'),
      [stu('s1', 'expected'), stu('s2', 'dropped')],
      [act('end_trip', { p_force: false, p_reason: null })],
    );
    expect(r.trip.status).toBe('completed');
    expect(statusOf(r, 's1')).toBe('missing');
    expect(statusOf(r, 's2')).toBe('dropped');
  });

  it('end_trip on from_school leaves students unchanged', () => {
    const r = applyPending(
      trip('from_school', 'in_progress'),
      [stu('s1', 'missing')],
      [act('end_trip', { p_force: false, p_reason: null })],
    );
    expect(r.trip.status).toBe('completed');
    expect(statusOf(r, 's1')).toBe('missing');
  });

  it('applies actions oldest first regardless of array order', () => {
    const a1 = act('mark_dropped', { p_student_id: 's1' });
    const a2 = act('undo_dropped', { p_student_id: 's1' });
    const r = applyPending(trip('from_school', 'in_progress'), [stu('s1', 'boarded')], [a2, a1]);
    expect(statusOf(r, 's1')).toBe('boarded');
  });

  it('a failed action is not applied and sets failedError', () => {
    const failed: QueuedAction = {
      ...act('mark_dropped', { p_student_id: 's1' }),
      state: 'failed',
      error: 'INVALID_STATE',
    };
    const r = applyPending(trip('from_school', 'in_progress'), [stu('s1', 'boarded')], [failed]);
    expect(statusOf(r, 's1')).toBe('boarded');
    expect(r.students[0]?.failedError).toBe('INVALID_STATE');
    expect(r.students[0]?.pending).toBe(false);
  });

  it('ignores actions for other trips', () => {
    const other = buildAction(
      'mark_dropped',
      { p_trip_id: 'other', p_student_id: 's1' },
      { id: 'x', now: new Date(), lat: null, lng: null },
    );
    const r = applyPending(trip('from_school', 'in_progress'), [stu('s1', 'boarded')], [other]);
    expect(statusOf(r, 's1')).toBe('boarded');
  });
});

describe('groupByStop', () => {
  it('orders groups by stop_sequence', () => {
    const rows = [
      { stop_id: 'b', stop_sequence: 2, n: 1 },
      { stop_id: 'a', stop_sequence: 1, n: 2 },
      { stop_id: 'b', stop_sequence: 2, n: 3 },
    ];
    const g = groupByStop(rows);
    expect(g.map((x) => x.stop_id)).toEqual(['a', 'b']);
    expect(g[1]?.rows.map((r) => r.n)).toEqual([1, 3]);
  });
});

describe('counts', () => {
  it('counts every status', () => {
    const c = counts([{ status: 'boarded' }, { status: 'boarded' }, { status: 'missing' }]);
    expect(c.boarded).toBe(2);
    expect(c.missing).toBe(1);
    expect(c.expected).toBe(0);
    expect(c.returned_to_school).toBe(0);
  });
});

describe('haversineMeters', () => {
  it('STOP_A1 to STOP_A2 is about 1.8 km', () => {
    const d = haversineMeters({ lat: 25.0935, lng: 55.2105 }, { lat: 25.079, lng: 55.219 });
    expect(d).toBeGreaterThan(1620);
    expect(d).toBeLessThan(1980);
  });
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 25, lng: 55 }, { lat: 25, lng: 55 })).toBe(0);
  });
});

describe('todayInDubai', () => {
  it('rolls over at 20:00 UTC', () => {
    expect(todayInDubai(new Date('2030-01-06T21:00:00Z'))).toBe('2030-01-07');
    expect(todayInDubai(new Date('2030-01-06T19:59:00Z'))).toBe('2030-01-06');
  });
});
