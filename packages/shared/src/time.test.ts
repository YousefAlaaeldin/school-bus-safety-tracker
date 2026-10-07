import { describe, expect, it } from 'vitest';
import { addDays, todayInDubai } from './time';

describe('time', () => {
  it('addDays crosses month and year ends', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01');
    expect(addDays('2029-12-31', 1)).toBe('2030-01-01');
    expect(addDays('2030-03-01', -1)).toBe('2030-02-28');
    expect(addDays('2030-01-07', 0)).toBe('2030-01-07');
  });
  it('todayInDubai is ahead of UTC late in the evening', () => {
    expect(todayInDubai(new Date('2030-01-07T21:00:00Z'))).toBe('2030-01-08');
    expect(todayInDubai(new Date('2030-01-07T19:00:00Z'))).toBe('2030-01-07');
  });
});
