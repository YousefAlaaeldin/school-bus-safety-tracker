import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'activeTripId';

/** Persisted (not React state), so the background task can read it when the OS wakes the app. */
export async function getActiveTripId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function setActiveTripId(tripId: string | null): Promise<void> {
  if (tripId) await AsyncStorage.setItem(KEY, tripId);
  else await AsyncStorage.removeItem(KEY);
}
