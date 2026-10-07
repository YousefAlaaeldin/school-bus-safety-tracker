import { describe, expect, it } from 'vitest';
import { fallbackEtas } from './fallbackEta';

const now = new Date('2030-01-07T12:00:00.000Z');
// STOP_A1 → STOP_A2 is about 1.8 km straight.
const a1 = { stop_id: 'a1', lat: 25.0935, lng: 55.2105 };
const a2 = { stop_id: 'a2', lat: 25.079, lng: 55.219 };

const secondsFrom = (iso: string) => (new Date(iso).getTime() - now.getTime()) / 1000;

describe('fallbackEtas', () => {
  it('returns [] for no stops', () => {
    expect(fallbackEtas(a1, [], now)).toEqual([]);
  });

  it('estimates 1.8 km straight as about 363 s', () => {
    const [first] = fallbackEtas(a1, [a2], now);
    // 1.8 km × 1.4 = 2.52 km at 25 km/h ≈ 363 s (distance is approximate, allow ±10%).
    const s = secondsFrom(first!.eta_at);
    expect(s).toBeGreaterThan(363 * 0.9);
    expect(s).toBeLessThan(363 * 1.1);
    expect(first!.source).toBe('fallback');
    expect(first!.stop_id).toBe('a2');
  });

  it('adds 60 s dwell for every stop already passed', () => {
    const origin = { lat: 25.1, lng: 55.2 };
    const noDwell = fallbackEtas(origin, [a1, a1], now);
    // Second stop is at the same place as the first: only the dwell separates them.
    expect(secondsFrom(noDwell[1]!.eta_at) - secondsFrom(noDwell[0]!.eta_at)).toBe(60);
  });

  it('ETAs increase along the route and keep stop order', () => {
    const res = fallbackEtas({ lat: 25.1, lng: 55.2 }, [a1, a2], now);
    expect(res.map((r) => r.stop_id)).toEqual(['a1', 'a2']);
    expect(secondsFrom(res[1]!.eta_at)).toBeGreaterThan(secondsFrom(res[0]!.eta_at));
  });
});
