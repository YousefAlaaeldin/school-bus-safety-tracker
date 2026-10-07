'use client';

import { AdvancedMarker, APIProvider, Map } from '@vis.gl/react-google-maps';

export type BusMarker = {
  tripId: string;
  label: string;
  lat: number;
  lng: number;
  /** True when the last position is more than 2 minutes old. */
  stale: boolean;
};

const DUBAI = { lat: 25.2048, lng: 55.2708 };

/** One marker per active bus. Markers turn grey when the position is stale. */
export function BusesMap({ markers, apiKey }: { markers: BusMarker[]; apiKey: string }) {
  const center = markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : DUBAI;

  return (
    // Maps are never mirrored in RTL.
    <div dir="ltr" className="h-80 w-full overflow-hidden rounded-xl border border-neutral-200 md:h-[28rem]">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={center}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
        >
          {markers.map((m) => (
            <AdvancedMarker key={m.tripId} position={{ lat: m.lat, lng: m.lng }} title={m.label}>
              <div
                className={`rounded-full border-2 border-white px-2 py-1 text-xs font-bold text-white shadow ${
                  m.stale ? 'bg-neutral-500' : 'bg-emerald-700'
                }`}
              >
                🚌 {m.label}
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
