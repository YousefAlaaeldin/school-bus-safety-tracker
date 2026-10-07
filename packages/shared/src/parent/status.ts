import type { StudentTripStatus, TripDirection, TripStatus } from '../enums';

/** The `parent.status.<key>` i18n key suffix for one journey line. */
export type JourneyKey =
  | 'scheduled'
  | 'boarded'
  | 'boardedEta'
  | 'droppedOff'
  | 'arrivedSchool'
  | 'returned'
  | 'missing'
  | 'absent'
  | 'noBus';

export type JourneyInput = {
  direction: TripDirection;
  tripStatus: TripStatus;
  studentStatus: StudentTripStatus;
  scheduledDeparture: string;
  boardedAt: string | null;
  droppedAt: string | null;
  etaAt: string | null;
};

export type JourneyStatus = {
  key: JourneyKey;
  /** The ISO time shown in the text, when the key has one. */
  time: string | null;
  tone: 'neutral' | 'active' | 'done' | 'danger';
};

/** Maps (direction, trip status, student status) to the status line shown to a parent (T3.10). */
export function journeyStatus(j: JourneyInput | null): JourneyStatus {
  if (!j || j.tripStatus === 'cancelled') return { key: 'noBus', time: null, tone: 'neutral' };
  switch (j.studentStatus) {
    case 'absent_reported':
      return { key: 'absent', time: null, tone: 'neutral' };
    case 'missing':
      return { key: 'missing', time: null, tone: 'danger' };
    case 'boarded':
      return j.etaAt
        ? { key: 'boardedEta', time: j.etaAt, tone: 'active' }
        : { key: 'boarded', time: null, tone: 'active' };
    case 'dropped':
      return j.direction === 'to_school'
        ? { key: 'arrivedSchool', time: j.droppedAt, tone: 'done' }
        : { key: 'droppedOff', time: j.droppedAt, tone: 'done' };
    case 'returned_to_school':
      return { key: 'returned', time: null, tone: 'neutral' };
    case 'expected':
    default:
      return { key: 'scheduled', time: j.scheduledDeparture, tone: 'neutral' };
  }
}

/** Mirrors `private.can_view_bus` for a guardian (rls.md §2): whether the Track button is shown. */
export function canTrackBus(j: Pick<JourneyInput, 'direction' | 'tripStatus' | 'studentStatus'>): boolean {
  if (j.tripStatus !== 'roll_call' && j.tripStatus !== 'in_progress') return false;
  if (j.studentStatus === 'boarded') return true;
  return j.direction === 'to_school' && j.tripStatus === 'in_progress' && j.studentStatus === 'expected';
}
