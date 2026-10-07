import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { rpcError } from '@/lib/supabase';
import { TripMap, type StopProgress } from '@/maps/TripMap';
import { useTrip } from '@/trip/useTrip';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/EmptyState';
import { Screen } from '@/ui/Screen';
import { spacing } from '@/ui/tokens';

export default function TripMapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, groups, stops, routeStopIds, loading, error, refetch } = useTrip(tripId);

  const markers = useMemo(() => {
    if (!trip || !stops) return [];
    // A stop is done when nobody there is still waiting to be picked up or dropped.
    const working = trip.direction === 'to_school' ? 'expected' : 'boarded';
    const doneByStop = new Map<string, boolean>();
    for (const g of groups ?? []) doneByStop.set(g.stop_id, !g.rows.some((r) => r.status === working));

    const order = routeStopIds && routeStopIds.length > 0 ? routeStopIds : (groups ?? []).map((g) => g.stop_id);
    let nextAssigned = false;
    return order.flatMap((stopId, index) => {
      const stop = stops[stopId];
      if (!stop) return [];
      let progress: StopProgress = 'upcoming';
      const done = stop.is_school ? false : (doneByStop.get(stopId) ?? true);
      if (done && !stop.is_school) progress = 'done';
      else if (!nextAssigned && !stop.is_school) {
        progress = 'next';
        nextAssigned = true;
      }
      return [{ stop, sequence: index + 1, progress }];
    });
  }, [trip, groups, stops, routeStopIds]);

  if (loading) return <Spinner />;
  if (error || !trip) {
    return (
      <Screen>
        <Banner kind="error" message={t(`errors.${rpcError(error)}`)} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TripMap stops={markers} />
      <View style={{ position: 'absolute', start: spacing[4], bottom: spacing[5] }}>
        <Button title={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
