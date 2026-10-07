import { describe, expect, it } from 'vitest';
import fixture from './fixtures/routes-3-legs.json';
import { routesEtas, type EtaStop, type FetchLike } from './routes';

const now = new Date('2030-01-07T12:00:00.000Z');
const origin = { lat: 25.1, lng: 55.2 };
const stops: EtaStop[] = [
  { stop_id: 's1', lat: 25.11, lng: 55.21 },
  { stop_id: 's2', lat: 25.12, lng: 55.22 },
  { stop_id: 's3', lat: 25.13, lng: 55.23 },
];

function okFetch(capture?: { url?: string; init?: RequestInit }): FetchLike {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.init = init;
    }
    return new Response(JSON.stringify(fixture), { status: 200 });
  };
}

describe('routesEtas', () => {
  it('turns leg durations into cumulative ETAs', async () => {
    const res = await routesEtas(origin, stops, 'key', now, okFetch());
    expect(res.map((r) => r.eta_at)).toEqual([
      new Date(now.getTime() + 300_000).toISOString(),
      new Date(now.getTime() + 720_000).toISOString(),
      new Date(now.getTime() + 900_000).toISOString(),
    ]);
    expect(res.every((r) => r.source === 'routes_api')).toBe(true);
    expect(res.map((r) => r.stop_id)).toEqual(['s1', 's2', 's3']);
  });

  it('sends 2 intermediates and the last stop as destination', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    await routesEtas(origin, stops, 'key', now, okFetch(cap));
    const body = JSON.parse(String(cap.init?.body));
    expect(body.intermediates).toHaveLength(2);
    expect(body.destination.location.latLng).toEqual({ latitude: 25.13, longitude: 55.23 });
    expect(body.origin.location.latLng).toEqual({ latitude: 25.1, longitude: 55.2 });
    expect(body.travelMode).toBe('DRIVE');
    expect(cap.url).toBe('https://routes.googleapis.com/directions/v2:computeRoutes');
  });

  it('sends the field mask and API key', async () => {
    const cap: { url?: string; init?: RequestInit } = {};
    await routesEtas(origin, stops, 'secret-key', now, okFetch(cap));
    const headers = cap.init?.headers as Record<string, string>;
    expect(headers['X-Goog-FieldMask']).toBe('routes.legs.duration');
    expect(headers['X-Goog-Api-Key']).toBe('secret-key');
  });

  it('returns [] for no stops without calling fetch', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('should not be called');
    };
    expect(await routesEtas(origin, [], 'key', now, fetchImpl)).toEqual([]);
  });

  it('throws ROUTES_HTTP_403 on a 403', async () => {
    const fetchImpl: FetchLike = async () => new Response('{}', { status: 403 });
    await expect(routesEtas(origin, stops, 'key', now, fetchImpl)).rejects.toThrow('ROUTES_HTTP_403');
  });

  it('throws ROUTES_BAD_RESPONSE on a leg count mismatch', async () => {
    await expect(routesEtas(origin, stops.slice(0, 2), 'key', now, okFetch())).rejects.toThrow(
      'ROUTES_BAD_RESPONSE',
    );
  });
});
