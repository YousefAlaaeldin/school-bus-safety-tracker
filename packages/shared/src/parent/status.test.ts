import { describe, expect, it } from 'vitest';
import { canTrackBus, journeyStatus, type JourneyInput } from './status';

const base: JourneyInput = {
  direction: 'from_school',
  tripStatus: 'in_progress',
  studentStatus: 'expected',
  scheduledDeparture: '2030-01-07T11:00:00Z',
  boardedAt: null,
  droppedAt: null,
  etaAt: null,
};

describe('journeyStatus', () => {
  it('no trip or a cancelled trip is "no bus"', () => {
    expect(journeyStatus(null).key).toBe('noBus');
    expect(journeyStatus({ ...base, tripStatus: 'cancelled' }).key).toBe('noBus');
  });
  it('expected shows the scheduled time', () => {
    expect(journeyStatus({ ...base, tripStatus: 'scheduled' })).toEqual({
      key: 'scheduled', time: base.scheduledDeparture, tone: 'neutral',
    });
  });
  it('boarded, with and without an ETA', () => {
    expect(journeyStatus({ ...base, studentStatus: 'boarded' }).key).toBe('boarded');
    const s = journeyStatus({ ...base, studentStatus: 'boarded', etaAt: '2030-01-07T11:30:00Z' });
    expect(s).toEqual({ key: 'boardedEta', time: '2030-01-07T11:30:00Z', tone: 'active' });
  });
  it('dropped depends on the direction', () => {
    const dropped = { ...base, studentStatus: 'dropped' as const, droppedAt: '2030-01-07T11:40:00Z' };
    expect(journeyStatus(dropped).key).toBe('droppedOff');
    expect(journeyStatus({ ...dropped, direction: 'to_school' }).key).toBe('arrivedSchool');
  });
  it('missing is a danger, absent is neutral', () => {
    expect(journeyStatus({ ...base, studentStatus: 'missing' }).tone).toBe('danger');
    expect(journeyStatus({ ...base, studentStatus: 'absent_reported' }).key).toBe('absent');
  });
  it('returned to school', () => {
    expect(journeyStatus({ ...base, studentStatus: 'returned_to_school' }).key).toBe('returned');
  });
});

describe('canTrackBus', () => {
  it('is true while boarded on a running trip', () => {
    expect(canTrackBus({ ...base, studentStatus: 'boarded' })).toBe(true);
    expect(canTrackBus({ ...base, tripStatus: 'roll_call', studentStatus: 'boarded' })).toBe(true);
  });
  it('is true for a morning trip in progress when expected', () => {
    expect(canTrackBus({ ...base, direction: 'to_school', studentStatus: 'expected' })).toBe(true);
  });
  it('is false for an afternoon trip when not boarded, and outside a running trip', () => {
    expect(canTrackBus({ ...base, studentStatus: 'expected' })).toBe(false);
    expect(canTrackBus({ ...base, tripStatus: 'scheduled', studentStatus: 'boarded' })).toBe(false);
    expect(canTrackBus({ ...base, tripStatus: 'completed', studentStatus: 'boarded' })).toBe(false);
    expect(canTrackBus({ ...base, direction: 'to_school', tripStatus: 'roll_call', studentStatus: 'expected' })).toBe(false);
  });
});
