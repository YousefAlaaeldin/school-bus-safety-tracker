import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getActiveTripId, setActiveTripId } from './activeTrip';
import { pingQueue, type Ping } from './pingQueue';
import { uploadPings } from './uploader';

export const BUS_LOCATION_TASK = 'bus-location-task';

function toPings(locations: Location.LocationObject[]): Ping[] {
  return locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    heading: l.coords.heading ?? null,
    speed_mps: l.coords.speed ?? null,
    accuracy_m: l.coords.accuracy ?? null,
    recorded_at: new Date(l.timestamp).toISOString(),
  }));
}

// Defined at import time, so the task exists when the OS wakes the app in the background.
TaskManager.defineTask(BUS_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const tripId = await getActiveTripId();
  if (!tripId) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  await pingQueue.add(tripId, toPings(locations));
  await uploadPings().catch(() => {}); // best effort; the queue keeps them if offline
});

let foregroundWatch: Location.LocationSubscription | null = null;

/** Fallback when background permission is missing: pings only while the app is open. */
async function startForegroundWatch(tripId: string) {
  foregroundWatch?.remove();
  foregroundWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 50 },
    (location) => {
      void pingQueue.add(tripId, toPings([location])).then(() => uploadPings().catch(() => {}));
    },
  );
}

export async function startBusTracking(tripId: string, t: (k: string) => string) {
  await setActiveTripId(tripId);
  try {
    await Location.startLocationUpdatesAsync(BUS_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 50,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: t('helper.tracking.notificationTitle'),
        notificationBody: t('helper.tracking.notificationBody'),
      },
    });
  } catch {
    // No background permission: still share the position while the app is open.
    await startForegroundWatch(tripId);
  }
}

export async function stopBusTracking() {
  foregroundWatch?.remove();
  foregroundWatch = null;
  if (await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BUS_LOCATION_TASK);
  }
  await setActiveTripId(null);
  await uploadPings().catch(() => {});
}
