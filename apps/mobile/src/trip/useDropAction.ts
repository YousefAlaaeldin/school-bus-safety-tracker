import { haversineMeters } from '@sst/shared';
import * as Location from 'expo-location';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useHelperAction } from '@/queue/useHelperAction';
import type { TripStop } from './useTrip';

type DropTarget = { student_id: string };

async function currentPosition(timeoutMs: number): Promise<{ lat: number; lng: number } | null> {
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Drops one or more students at a stop. If the phone is farther from the stop than the school's
 * warning distance, asks first ("Drop anyway"). Returns true when the drops were queued.
 */
export function useDropAction(tripId: string, dropDistanceWarningM: number) {
  const { t } = useTranslation();
  const run = useHelperAction();

  return useCallback(
    async (targets: DropTarget[], stop: TripStop | undefined): Promise<boolean> => {
      if (targets.length === 0) return false;

      if (stop) {
        const position = await currentPosition(3000);
        if (position) {
          const meters = Math.round(haversineMeters(position, { lat: stop.lat, lng: stop.lng }));
          if (meters > dropDistanceWarningM) {
            const proceed = await new Promise<boolean>((resolve) => {
              Alert.alert(t('helper.drop.dropped'), t('helper.drop.farWarning', { meters }), [
                { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('helper.drop.dropAnyway'), style: 'destructive', onPress: () => resolve(true) },
              ], { cancelable: true, onDismiss: () => resolve(false) });
            });
            if (!proceed) return false;
          }
        }
      }

      for (const target of targets) {
        await run('mark_dropped', { p_trip_id: tripId, p_student_id: target.student_id });
      }
      return true;
    },
    [run, t, tripId, dropDistanceWarningM],
  );
}
