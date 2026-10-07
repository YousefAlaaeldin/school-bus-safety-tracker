'use client';

import { AdvancedMarker, APIProvider, Map, type MapMouseEvent } from '@vis.gl/react-google-maps';

export type LatLng = { lat: number; lng: number };

const DUBAI: LatLng = { lat: 25.2048, lng: 55.2708 };

/** A map where a click places a draggable pin. Reports `{lat, lng}` through `onChange`. */
export function PinPicker({
  value,
  center,
  onChange,
  apiKey,
}: {
  value: LatLng | null;
  /** Where to open the map when there is no pin yet (e.g. the school stop). */
  center?: LatLng | null;
  onChange: (point: LatLng) => void;
  apiKey: string;
}) {
  const start = value ?? center ?? DUBAI;

  return (
    // Maps are never mirrored in RTL.
    <div dir="ltr" className="h-72 w-full overflow-hidden rounded-xl border border-neutral-200">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={start}
          defaultZoom={value ? 15 : 11}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          onClick={(e: MapMouseEvent) => {
            const ll = e.detail.latLng;
            if (ll) onChange({ lat: ll.lat, lng: ll.lng });
          }}
        >
          {value ? (
            <AdvancedMarker
              position={value}
              draggable
              onDragEnd={(e) => {
                const ll = e.latLng;
                if (ll) onChange({ lat: ll.lat(), lng: ll.lng() });
              }}
            />
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}
