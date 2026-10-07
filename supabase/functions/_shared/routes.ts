export type LatLng = { lat: number; lng: number };
export type EtaStop = { stop_id: string; lat: number; lng: number };
export type EtaResult = { stop_id: string; eta_at: string; source: 'routes_api' | 'fallback' };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export async function routesEtas(
  origin: LatLng,
  stops: EtaStop[],
  apiKey: string,
  now: Date,
  fetchImpl: FetchLike,
): Promise<EtaResult[]> {
  const last = stops[stops.length - 1];
  if (!last) return [];
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const body = {
    origin: wp(origin),
    destination: wp(last),
    intermediates: stops.slice(0, -1).map(wp),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };
  const res = await fetchImpl(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.legs.duration',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ROUTES_HTTP_${res.status}`);
  const json = (await res.json()) as { routes?: { legs?: { duration?: string }[] }[] };
  const legs = json.routes?.[0]?.legs ?? [];
  if (legs.length !== stops.length) throw new Error('ROUTES_BAD_RESPONSE');
  let acc = 0;
  return stops.map((s, i) => {
    acc += parseInt((legs[i]?.duration ?? '0s').replace('s', ''), 10);
    return {
      stop_id: s.stop_id,
      eta_at: new Date(now.getTime() + acc * 1000).toISOString(),
      source: 'routes_api' as const,
    };
  });
}
