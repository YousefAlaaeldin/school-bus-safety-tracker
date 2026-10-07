// Replays a GPS route against the local stack, as if a helper's phone were driving it.
// Usage: pnpm gps:replay --trip <id> --phone +971500000002 --otp 123456 --speed 10 --interval 10
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Position = { lat: number; lng: number };
type Ping = { lat: number; lng: number; recorded_at: string; heading?: number; speed_mps?: number };

export type ReplayOptions = {
  tripId: string;
  phone: string;
  otp: string;
  /** Simulation speed multiplier (1 = real time). */
  speed: number;
  /** Simulated seconds between pings. */
  interval: number;
  supabaseUrl?: string;
  anonKey?: string;
  routeFile?: string;
  /** Called after each batch; return false to stop early. */
  onProgress?: (info: { simSeconds: number; position: Position; sent: number }) => boolean | void;
  /** An already signed-in client (skips the OTP step). */
  client?: SupabaseClient;
};

const BUS_SPEED_MPS = (30 * 1000) / 3600; // 30 km/h
const STOP_PAUSE_S = 30;
const EARTH_RADIUS_M = 6_371_000;

function haversine(a: Position, b: Position): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function loadRoute(file: string): { points: Position[]; stopIndices: number[] } {
  const feature = JSON.parse(readFileSync(file, 'utf8')) as {
    properties: { stopIndices: number[] };
    geometry: { coordinates: [number, number][] };
  };
  return {
    points: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    stopIndices: feature.properties.stopIndices,
  };
}

/**
 * Builds the simulated timeline: a position every `interval` simulated seconds, driving at 30 km/h
 * and pausing 30 s at each stop. Pure, so tests can check it without a server.
 */
export function buildTimeline(
  points: Position[],
  stopIndices: number[],
  interval: number,
): { t: number; position: Position; moving: boolean }[] {
  // Events along the route: [simTime, position, moving]
  const keyframes: { t: number; position: Position; moving: boolean }[] = [];
  let t = 0;
  const first = points[0];
  if (!first) return [];
  keyframes.push({ t, position: first, moving: false });

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    t += haversine(a, b) / BUS_SPEED_MPS;
    keyframes.push({ t, position: b, moving: true });
    if (stopIndices.includes(i)) {
      t += STOP_PAUSE_S;
      keyframes.push({ t, position: b, moving: false });
    }
  }

  // Sample every `interval` seconds by interpolating between keyframes.
  const samples: { t: number; position: Position; moving: boolean }[] = [];
  let k = 0;
  for (let s = 0; s <= t; s += interval) {
    while (k < keyframes.length - 2 && keyframes[k + 1]!.t < s) k++;
    const a = keyframes[k]!;
    const b = keyframes[k + 1] ?? a;
    const span = b.t - a.t;
    const f = span <= 0 ? 0 : Math.min(1, Math.max(0, (s - a.t) / span));
    samples.push({
      t: s,
      position: { lat: a.position.lat + (b.position.lat - a.position.lat) * f, lng: a.position.lng + (b.position.lng - a.position.lng) * f },
      moving: b.moving,
    });
  }
  return samples;
}

async function signIn(opts: ReplayOptions): Promise<SupabaseClient> {
  if (opts.client) return opts.client;
  const url = opts.supabaseUrl ?? process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const anonKey = opts.anonKey ?? process.env.SUPABASE_ANON_KEY ?? '';
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: sendError } = await client.auth.signInWithOtp({ phone: opts.phone });
  if (sendError) throw new Error(`OTP request failed: ${sendError.message}`);
  const { error } = await client.auth.verifyOtp({ phone: opts.phone, token: opts.otp, type: 'sms' });
  if (error) throw new Error(`OTP verify failed: ${error.message}`);
  return client;
}

/** Drives the whole route once, sending a batch of pings to `ingest_pings` every real second. */
export async function replayOnce(opts: ReplayOptions): Promise<{ sent: number }> {
  const here = dirname(fileURLToPath(import.meta.url));
  const { points, stopIndices } = loadRoute(opts.routeFile ?? join(here, 'routes', 'a-pm.geojson'));
  const timeline = buildTimeline(points, stopIndices, opts.interval);
  const client = await signIn(opts);

  let sent = 0;
  let next = 0;
  let msOffset = 0;
  const startedReal = Date.now();

  while (next < timeline.length) {
    const simNow = ((Date.now() - startedReal) / 1000) * opts.speed;
    const batch: Ping[] = [];
    while (next < timeline.length && timeline[next]!.t <= simNow) {
      const sample = timeline[next]!;
      // recorded_at must be unique per trip, so spread pings of one batch by a millisecond each.
      batch.push({
        lat: sample.position.lat,
        lng: sample.position.lng,
        recorded_at: new Date(Date.now() + msOffset++).toISOString(),
        speed_mps: sample.moving ? BUS_SPEED_MPS : 0,
      });
      next++;
    }
    if (batch.length > 0) {
      const { error } = await client.rpc('ingest_pings', { p_trip_id: opts.tripId, p_pings: batch });
      if (error) throw new Error(`ingest_pings failed: ${error.message}`);
      sent += batch.length;
      const last = batch[batch.length - 1]!;
      const keepGoing = opts.onProgress?.({ simSeconds: Math.round(simNow), position: last, sent });
      if (keepGoing === false) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { sent };
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.trip) {
    console.error('Usage: pnpm gps:replay --trip <id> [--phone +971500000002] [--otp 123456] [--speed 10] [--interval 10]');
    process.exit(1);
  }
  replayOnce({
    tripId: args.trip,
    phone: args.phone ?? '+971500000002',
    otp: args.otp ?? '123456',
    speed: Number(args.speed ?? 10),
    interval: Number(args.interval ?? 10),
    onProgress: ({ simSeconds, position, sent }) => {
      console.log(`t=${simSeconds}s  ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}  (${sent} pings sent)`);
    },
  })
    .then(({ sent }) => console.log(`done: ${sent} pings`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
