import type { StudentTripStatus, TripDirection, TripStatus } from '../enums';
import { STUDENT_TRIP_STATUSES } from '../enums';
import type { QueuedAction } from '../queue/queue';

export type TripRow = { id: string; direction: TripDirection; status: TripStatus };
export type StudentRow = {
  student_id: string;
  stop_id: string;
  stop_sequence: number;
  status: StudentTripStatus;
  name_ar: string;
  name_en: string;
  photo_path: string | null;
};
export type StudentView = StudentRow & { pending: boolean; failedError?: string };

function byCreatedAt(a: QueuedAction, b: QueuedAction): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

function studentIdOf(action: QueuedAction): string | null {
  const id = action.args.p_student_id;
  return typeof id === 'string' ? id : null;
}

/**
 * Optimistically applies queued actions to server rows, using the same status rules as the
 * server (rpc.md §3.1–3.3). Invalid transitions are ignored. Failed actions are not applied;
 * they only set `failedError` on the student they target.
 */
export function applyPending(
  trip: TripRow,
  students: StudentRow[],
  actions: QueuedAction[],
): { trip: TripRow; students: StudentView[] } {
  let tripStatus: TripStatus = trip.status;
  const views = new Map<string, StudentView>(
    students.map((s) => [s.student_id, { ...s, pending: false }]),
  );

  const setStatus = (v: StudentView, status: StudentTripStatus) => {
    v.status = status;
    v.pending = true;
  };

  const mine = actions.filter((a) => a.args.p_trip_id === trip.id);

  for (const action of [...mine].sort(byCreatedAt)) {
    if (action.state === 'failed') {
      const sid = studentIdOf(action);
      const v = sid ? views.get(sid) : undefined;
      if (v) v.failedError = action.error ?? 'UNKNOWN';
      continue;
    }

    const sid = studentIdOf(action);
    const v = sid ? views.get(sid) : undefined;

    switch (action.rpc) {
      case 'start_trip':
        if (tripStatus === 'scheduled') {
          tripStatus = trip.direction === 'from_school' ? 'roll_call' : 'in_progress';
        }
        break;
      case 'set_boarded': {
        if (!v) break;
        if (action.args.p_boarded === false) {
          if (v.status === 'boarded') {
            const missing = trip.direction === 'from_school' && tripStatus === 'in_progress';
            setStatus(v, missing ? 'missing' : 'expected');
          }
        } else if (
          v.status === 'expected' ||
          v.status === 'missing' ||
          v.status === 'absent_reported'
        ) {
          setStatus(v, 'boarded');
        }
        break;
      }
      case 'confirm_roll_call':
        if (trip.direction === 'from_school' && tripStatus === 'roll_call') {
          for (const s of views.values()) {
            if (s.status === 'expected') setStatus(s, 'missing');
          }
          tripStatus = 'in_progress';
        }
        break;
      case 'mark_dropped':
        if (v && v.status === 'boarded') setStatus(v, 'dropped');
        break;
      case 'undo_dropped':
        if (v && v.status === 'dropped') setStatus(v, 'boarded');
        break;
      case 'mark_no_show':
        if (v && v.status === 'expected') setStatus(v, 'missing');
        break;
      case 'undo_no_show':
        if (v && v.status === 'missing') setStatus(v, 'expected');
        break;
      case 'arrive_at_school':
        if (trip.direction === 'to_school' && tripStatus === 'in_progress') {
          for (const s of views.values()) {
            if (s.status === 'boarded') setStatus(s, 'dropped');
          }
        }
        break;
      case 'mark_returned_to_school':
        if (v && v.status === 'boarded') setStatus(v, 'returned_to_school');
        break;
      case 'end_trip':
        if (tripStatus === 'in_progress') {
          if (trip.direction === 'to_school') {
            for (const s of views.values()) {
              if (s.status === 'expected') setStatus(s, 'missing');
            }
          }
          tripStatus = 'completed';
        }
        break;
    }
  }

  return { trip: { ...trip, status: tripStatus }, students: [...views.values()] };
}

/** Groups rows by stop, ordered by stop_sequence. Row order within a stop is preserved. */
export function groupByStop<T extends { stop_id: string; stop_sequence: number }>(
  rows: T[],
): { stop_id: string; stop_sequence: number; rows: T[] }[] {
  const groups = new Map<string, { stop_id: string; stop_sequence: number; rows: T[] }>();
  for (const row of rows) {
    let g = groups.get(row.stop_id);
    if (!g) {
      g = { stop_id: row.stop_id, stop_sequence: row.stop_sequence, rows: [] };
      groups.set(row.stop_id, g);
    }
    g.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.stop_sequence - b.stop_sequence);
}

export function counts(rows: { status: StudentTripStatus }[]): Record<StudentTripStatus, number> {
  const result = Object.fromEntries(STUDENT_TRIP_STATUSES.map((s) => [s, 0])) as Record<
    StudentTripStatus,
    number
  >;
  for (const row of rows) result[row.status] += 1;
  return result;
}
