import * as Location from 'expo-location';

export type PermissionState = 'ok' | 'needsForeground' | 'needsBackground' | 'denied';

/** What the helper has granted right now, without asking. */
export async function checkPermissions(): Promise<PermissionState> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return foreground.canAskAgain === false ? 'denied' : 'needsForeground';
  }
  const background = await Location.getBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'ok' : 'needsBackground';
}

/**
 * Asks for foreground permission first, then background ("Always" on iOS, "all the time" on Android).
 * Returns what is still missing.
 */
export async function ensurePermissions(): Promise<PermissionState> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return foreground.canAskAgain === false ? 'denied' : 'needsForeground';
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'ok' : 'needsBackground';
}
