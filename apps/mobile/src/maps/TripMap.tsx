import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getLanguage } from '@/i18n';
import type { TripStop } from '@/trip/useTrip';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/tokens';

export type StopProgress = 'done' | 'next' | 'upcoming';

type Props = {
  /** Stops in driving order. */
  stops: { stop: TripStop; sequence: number; progress: StopProgress }[];
};

const PIN_COLOR: Record<StopProgress, string> = {
  done: colors.muted,
  next: colors.primary,
  upcoming: colors.text,
};

/** Numbered markers per stop (grey = done, green = next, dark = upcoming) plus the user's position. */
export function TripMap({ stops }: Props) {
  const ref = useRef<MapView>(null);
  const ar = getLanguage() === 'ar';

  useEffect(() => {
    if (stops.length === 0) return;
    const id = setTimeout(() => {
      ref.current?.fitToCoordinates(
        stops.map((s) => ({ latitude: s.stop.lat, longitude: s.stop.lng })),
        { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: false },
      );
    }, 300);
    return () => clearTimeout(id);
  }, [stops]);

  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      showsUserLocation
      // Maps are never mirrored in RTL.
      initialRegion={{ latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0.2, longitudeDelta: 0.2 }}
    >
      {stops.map(({ stop, sequence, progress }) => (
        <Marker
          key={stop.id}
          coordinate={{ latitude: stop.lat, longitude: stop.lng }}
          title={ar ? stop.label_ar : stop.label_en}
          tracksViewChanges={false}
        >
          <View
            style={{
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              paddingHorizontal: 6,
              backgroundColor: PIN_COLOR[progress],
              borderColor: colors.surface,
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" weight="bold" style={{ color: colors.onPrimary }}>
              {stop.is_school ? '🏫' : sequence}
            </Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}
