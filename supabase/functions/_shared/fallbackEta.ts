import type { EtaResult, EtaStop, LatLng } from './routes.ts';

const ROAD_FACTOR = 1.4;
const SPEED_KMH = 25;
const DWELL_SECONDS = 60;
const EARTH_RADIUS_M = 6_371_000;

// Copied from packages/shared/src/geo.ts: Edge Functions can't import from packages (Deno).
function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line estimate used when the Routes API is unavailable: origin → stop1 → stop2 …,
 * distance × 1.4 at 25 km/h, plus 60 s dwell for every stop already passed.
 */
export function fallbackEtas(origin: LatLng, stops: EtaStop[], now: Date): EtaResult[] {
  let seconds = 0;
  let from = origin;
  return stops.map((stop, i) => {
    const meters = haversineMeters(from, stop) * ROAD_FACTOR;
    seconds += (meters / 1000 / SPEED_KMH) * 3600;
    if (i > 0) seconds += DWELL_SECONDS;
    from = stop;
    return {
      stop_id: stop.stop_id,
      eta_at: new Date(now.getTime() + Math.round(seconds) * 1000).toISOString(),
      source: 'fallback' as const,
    };
  });
}
